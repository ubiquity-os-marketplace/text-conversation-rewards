import { TypeBoxError } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { callLlm } from "@ubiquity-os/plugin-sdk";
import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import Decimal from "decimal.js";
import { encodingForModel } from "js-tiktoken";
import { CommentAssociation, commentEnum, CommentKind, CommentType } from "../configuration/comment-types";
import { ContentEvaluatorConfiguration, EvaluationWeights } from "../configuration/content-evaluator-config";
import { extractFirstJsonObject } from "../helpers/extract-first-json-object";
import { extractOriginalAuthor } from "../helpers/original-author";
import { checkLlmRetryableState, retry } from "../helpers/retry";
import { IssueActivity } from "../issue-activity";
import {
  AllComments,
  CommentToEvaluate,
  EvaluationDimension,
  openAiRelevanceResponseSchema,
  PrCommentToEvaluate,
  Relevances,
} from "../types/content-evaluator-module-type";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { LINKED_ISSUES, PullRequestClosingIssue } from "../types/requests";
import { GithubCommentScore, Result } from "../types/results";

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    Symbol.asyncIterator in value &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function"
  );
}

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule extends BaseModule {
  readonly _configuration: ContentEvaluatorConfiguration | null = this.context.config.incentives.contentEvaluator;
  private readonly _fixedRelevances: { [k: string]: number } = {};
  private _tokenLimit: number = 0;
  private readonly _originalAuthorWeight: number = 0.5;
  private _basePriority: number = 1;

  _getEnumValue(key: CommentType) {
    let res = 0;

    key.split("_").forEach((value) => {
      res |= Number(commentEnum[value as keyof typeof commentEnum]);
    });
    return res;
  }

  constructor(context: ContextPlugin) {
    super(context);
    if (this._configuration?.multipliers) {
      this._fixedRelevances = this._configuration.multipliers.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.role.reduce((a, b) => this._getEnumValue(b) | a, 0)]: curr.relevance,
        };
      }, {});
    }
    if (this._configuration?.originalAuthorWeight !== undefined) {
      this._originalAuthorWeight = this._configuration.originalAuthorWeight;
    }
  }

  get enabled(): boolean {
    if (!this._configuration) {
      this.context.logger.warn(
        "The configuration for the module ContentEvaluatorModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    if (!this._configuration?.openAi.tokenCountLimit) {
      throw this.context.logger.fatal("Token count limit is missing, comments cannot be evaluated.");
    }
    this._tokenLimit = this._configuration.openAi.tokenCountLimit;
    this.context.logger.info(`Using token limit: ${this._tokenLimit}`);

    const promises: Promise<GithubCommentScore[]>[] = [];
    this._basePriority = await this.computePriority(data);
    const allComments: { id: number; comment: string; author: string }[] = [];

    for (const [user, data] of Object.entries(result)) {
      if (data.comments?.length) {
        allComments.push(
          ...data.comments
            .filter(
              (comment) =>
                comment.commentType & CommentKind.ISSUE && !(comment.commentType & CommentAssociation.SPECIFICATION)
            )
            .map((comment) => ({ id: comment.id, comment: comment.content, author: user }))
        );
      }
    }

    for (const username of Object.keys(result)) {
      const currentElement = result[username];
      const comments = currentElement.comments ?? [];
      const specificationBody = data.self?.body;

      if (specificationBody && comments.length) {
        promises.push(
          this._processComment(username, comments, specificationBody, allComments).then(
            (commentsWithScore) => (currentElement.comments = commentsWithScore)
          )
        );
      }
    }

    await Promise.all(promises);
    if (data?.self?.body) {
      await this._handleRewardsForOriginalAuthor(data.self.body, result);
    }
    return result;
  }

  /*
   * If the specification was created from the comment of another user, reward that user accordingly.
   */
  private async _handleRewardsForOriginalAuthor(body: string, result: Result) {
    const originalComment = extractOriginalAuthor(body);
    const issueAuthor =
      "issue" in this.context.payload
        ? this.context.payload.issue.user?.login
        : this.context.payload.pull_request?.user?.login;

    if (!originalComment || !issueAuthor || issueAuthor === originalComment.username) return;

    const specReward = this._extractAndAdjustSpecReward(result);
    if (!specReward) return;

    await this._addRewardForAuthor(result, originalComment.username, specReward);
  }

  private _extractAndAdjustSpecReward(result: Result) {
    for (const resultKey of Object.keys(result)) {
      const comments = result[resultKey].comments;
      if (!comments) continue;

      const spec = comments.find((comment) => comment.commentType & CommentAssociation.SPECIFICATION);
      if (spec && spec.score?.reward !== undefined) {
        const reward = new Decimal(spec.score.reward);
        const authorWeight = new Decimal(1).minus(this._originalAuthorWeight);
        const authorReward = reward.mul(authorWeight).toNumber();
        const originalAuthorReward = reward.mul(this._originalAuthorWeight).toNumber();
        spec.score.reward = authorReward;
        spec.score.weight = authorWeight.toNumber();
        const originalAuthorSpec = structuredClone(spec);
        // @ts-expect-error Cannot be undefined since we check it in this if closure
        originalAuthorSpec.score.reward = originalAuthorReward;
        // @ts-expect-error Cannot be undefined since we check it in this if closure
        originalAuthorSpec.score.weight = this._originalAuthorWeight;
        return originalAuthorSpec;
      }
    }
    return undefined;
  }

  private async _addRewardForAuthor(result: Result, username: string, specReward: GithubCommentScore) {
    if (result[username]?.comments) {
      result[username].comments.push(specReward);
    } else {
      const userId = await this._fetchGithubUserId(username);
      if (!userId) return;
      result[username] = {
        ...result[username],
        total: 0,
        userId,
        comments: [specReward],
      };
    }
  }

  private async _fetchGithubUserId(username: string) {
    try {
      const userResponse = await this.context.octokit.rest.users.getByUsername({ username });
      // We do not want to reward bot accounts
      if (userResponse.data.type === "Bot") {
        return 0;
      }
      return userResponse.data.id;
    } catch (err) {
      this.context.logger.warn("Failed to fetch the user ID.", { username, err });
      return 0;
    }
  }

  async _processComment(
    username: string,
    comments: Readonly<GithubCommentScore>[],
    specificationBody: string,
    allComments: AllComments
  ) {
    const commentsWithScore: GithubCommentScore[] = [...comments];
    const { commentsToEvaluate, prCommentsToEvaluate } = this._splitCommentsByPrompt(commentsWithScore);

    const relevancesByAi = await retry(
      async () => {
        const relevances = await this._evaluateComments(
          specificationBody,
          username,
          commentsToEvaluate,
          allComments,
          prCommentsToEvaluate
        );

        const expectedRelevances = this.isPullRequest() ? prCommentsToEvaluate.length : commentsToEvaluate.length;
        if (Object.keys(relevances).length !== expectedRelevances) {
          throw this.context.logger.error("There was a mismatch between the relevance scores and amount of comments.", {
            expectedRelevances,
            receivedRelevances: Object.keys(relevances).length,
            prComments: prCommentsToEvaluate.length,
            issueComments: commentsToEvaluate.length,
            relevances,
            commentsToEvaluate,
            prCommentsToEvaluate,
          });
        }

        return relevances;
      },
      {
        maxRetries: this._configuration?.openAi.maxRetries ?? 5,
        onError: async (error) => {
          if (this.context.config.incentives.githubComment?.post) {
            await this.context.commentHandler.postComment(
              this.context,
              this.context.logger.ok("Results are being retried", { err: error }),
              {
                updateComment: true,
              }
            );
          }
          this.context.logger.error("retry onError", { err: error });
        },
        isErrorRetryable: (error) => {
          const llmRetryable = checkLlmRetryableState(error);
          // Retry if there is a SyntaxError caused by malformed JSON or TypeBoxError caused by incorrect JSON from OpenAI
          return (
            llmRetryable || error instanceof SyntaxError || error instanceof TypeBoxError || error instanceof LogReturn
          );
        },
      }
    );

    for (const currentComment of commentsWithScore) {
      let currentRelevance = 1; // For comments not in fixed relevance types and missed by OpenAI evaluation
      if (this._fixedRelevances[currentComment.commentType]) {
        currentRelevance = this._fixedRelevances[currentComment.commentType];
      } else if (!isNaN(relevancesByAi[currentComment.id])) {
        currentRelevance = relevancesByAi[currentComment.id];
      }

      const currentReward = new Decimal(currentComment.score?.reward ?? 0);
      const basePriority = this._basePriority;
      const priority =
        // We do not apply priority multiplier on issue specification
        !(currentComment.commentType & CommentAssociation.SPECIFICATION) ? basePriority : 1;

      currentComment.score = {
        ...(currentComment.score || { multiplier: 0 }),
        relevance: new Decimal(currentRelevance).toNumber(),
        priority: priority,
        reward: currentReward.mul(currentRelevance).mul(priority).toDecimalPlaces(3).toNumber(),
        authorship: currentComment.score?.authorship ?? 1,
      };
    }

    return commentsWithScore;
  }

  /**
   * Will try to predict the maximum of tokens expected, to a maximum of totalTokenLimit.
   */
  _calculateMaxTokens(prompt: string, totalTokenLimit: number = 16384) {
    const tokenizer = encodingForModel("gpt-4o");
    const inputTokens = tokenizer.encode(prompt).length * 2; // Safety margin
    return Math.min(inputTokens, totalTokenLimit);
  }

  _generateDummyResponse(comments: { id: number; comment: string }[]) {
    return comments.reduce<Record<string, number>>((acc, curr) => {
      return { ...acc, [curr.id]: 0.5 };
    }, {});
  }

  _splitCommentsByPrompt(commentsWithScore: Readonly<GithubCommentScore>[]): {
    commentsToEvaluate: CommentToEvaluate[];
    prCommentsToEvaluate: PrCommentToEvaluate[];
  } {
    const commentsToEvaluate: CommentToEvaluate[] = [];
    const prCommentsToEvaluate: PrCommentToEvaluate[] = [];
    for (const currentComment of commentsWithScore) {
      if (!this._fixedRelevances[currentComment.commentType]) {
        if (currentComment.commentType & CommentKind.PULL) {
          prCommentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
            diffHunk: currentComment?.diffHunk,
          });
        } else {
          commentsToEvaluate.push({
            id: currentComment.id,
            comment: currentComment.content,
          });
        }
      }
    }
    return { commentsToEvaluate, prCommentsToEvaluate };
  }

  _splitArrayToChunks<T extends CommentToEvaluate[] | AllComments>(array: T, chunks: number) {
    const arrayCopy = [...array];
    const result = [];
    for (let i = chunks; i > 0; i--) {
      result.push(arrayCopy.splice(0, Math.ceil(arrayCopy.length / i)));
    }
    return result;
  }

  private _getEvaluationWeights(): EvaluationWeights {
    const configured = this._configuration?.evaluationWeights;
    return {
      relevance: Number.isFinite(configured?.relevance) ? Number(configured?.relevance) : 0.4,
      helpfulness: Number.isFinite(configured?.helpfulness) ? Number(configured?.helpfulness) : 0.3,
      research: Number.isFinite(configured?.research) ? Number(configured?.research) : 0.3,
    };
  }

  _combineWeightedScores(
    dimensionResults: Array<{ weight: number; scores: Relevances }>,
    expectedCommentIds: number[]
  ): Relevances {
    const activeDimensions = dimensionResults.filter((entry) => entry.weight > 0);
    if (!activeDimensions.length) {
      return {};
    }
    const totalWeight = activeDimensions.reduce((acc, curr) => acc.add(curr.weight), new Decimal(0));
    if (totalWeight.lte(0)) {
      return {};
    }

    const combined: Relevances = {};
    for (const commentId of expectedCommentIds) {
      const key = String(commentId);
      const hasAllDimensions = activeDimensions.every(
        (entry) => Object.prototype.hasOwnProperty.call(entry.scores, key) && !Number.isNaN(entry.scores[key])
      );
      if (!hasAllDimensions) {
        continue;
      }
      const weightedSum = activeDimensions.reduce(
        (acc, entry) => acc.add(new Decimal(entry.scores[key]).mul(entry.weight)),
        new Decimal(0)
      );
      combined[key] = weightedSum.div(totalWeight).toDecimalPlaces(3).toNumber();
    }
    return combined;
  }

  async _splitPromptForIssueCommentEvaluation(
    specification: string,
    username: string,
    comments: CommentToEvaluate[],
    allComments: AllComments,
    dimension: EvaluationDimension = "relevance"
  ) {
    const commentRelevances: Relevances = {};
    const evaluationCounts: Record<string, number> = {};

    const maxChunks = Math.max(allComments.length, 1);
    let chunks = 0;

    for (let currentChunk = 2; currentChunk <= maxChunks; currentChunk++) {
      const chunkTokenEstimates = this._getIssueChunkEstimates(
        specification,
        username,
        allComments,
        currentChunk,
        dimension
      );
      if (!chunkTokenEstimates.length) {
        continue;
      }
      const maxPromptTokens = Math.max(...chunkTokenEstimates.map((estimate) => estimate.promptTokens));
      const maxOutputTokens = Math.max(...chunkTokenEstimates.map((estimate) => estimate.outputTokens));
      if (maxPromptTokens + maxOutputTokens <= this._tokenLimit) {
        chunks = currentChunk;
        break;
      }
    }

    if (!chunks) {
      const fallbackPrompt = this._generatePromptForComments(specification, username, allComments, dimension);
      const dummyResponse = JSON.stringify(this._generateDummyResponse(comments), null, 2);
      const fallbackPromptTokens = this._calculateMaxTokens(fallbackPrompt, Infinity);
      const fallbackOutputTokens = this._calculateMaxTokens(dummyResponse);
      this.context.logger.warn("Unable to reduce issue comment evaluation below token limit", {
        tokenLimit: this._tokenLimit,
        promptTokens: fallbackPromptTokens,
        outputTokens: fallbackOutputTokens,
        comments: allComments.length,
      });
      return this._submitPrompt(fallbackPrompt, fallbackOutputTokens);
    }

    this.context.logger.debug(`Splitting issue comments into ${chunks} chunks`);

    for (const commentSplit of this._splitArrayToChunks(allComments, chunks)) {
      const targetComments = commentSplit.filter((comment) => comment.author === username);
      if (!targetComments.length) {
        continue;
      }
      const dummyResponse = JSON.stringify(this._generateDummyResponse(targetComments), null, 2);
      const maxOutputTokens = this._calculateMaxTokens(dummyResponse);
      const promptForComments = this._generatePromptForComments(specification, username, commentSplit, dimension);

      for (const [key, value] of Object.entries(await this._submitPrompt(promptForComments, maxOutputTokens))) {
        const accumulated = commentRelevances[key] ?? 0;
        commentRelevances[key] = new Decimal(accumulated).add(value).toNumber();
        evaluationCounts[key] = (evaluationCounts[key] ?? 0) + 1;
      }
    }

    for (const key of Object.keys(commentRelevances)) {
      const count = evaluationCounts[key] ?? 1;
      commentRelevances[key] = new Decimal(commentRelevances[key]).div(count).toNumber();
    }

    return commentRelevances;
  }

  private _getIssueChunkEstimates(
    specification: string,
    username: string,
    allComments: AllComments,
    chunks: number,
    dimension: EvaluationDimension = "relevance"
  ): { promptTokens: number; outputTokens: number }[] {
    return this._splitArrayToChunks(allComments, chunks)
      .map((chunk) => {
        if (!chunk.some((comment) => comment.author === username)) {
          return null;
        }
        const promptTokens = this._calculateMaxTokens(
          this._generatePromptForComments(specification, username, chunk, dimension),
          Infinity
        );
        const dummyResponse = JSON.stringify(
          this._generateDummyResponse(chunk.filter((comment) => comment.author === username)),
          null,
          2
        );
        const outputTokens = this._calculateMaxTokens(dummyResponse);
        return { promptTokens, outputTokens };
      })
      .filter((value): value is { promptTokens: number; outputTokens: number } => value !== null);
  }

  async _splitPromptForPullRequestCommentEvaluation(
    specification: string | string[],
    comments: PrCommentToEvaluate[],
    dimension: EvaluationDimension = "relevance"
  ) {
    const commentRelevances: Relevances = {};

    let chunks = 2;
    while (
      Math.max(
        ...this._splitArrayToChunks(comments, chunks).map(
          (chunk) =>
            this._calculateMaxTokens(JSON.stringify(this._generateDummyResponse(chunk), null, 2)) +
            this._calculateMaxTokens(this._generatePromptForPrComments(specification, chunk, dimension), Infinity)
        )
      ) > this._tokenLimit
    ) {
      chunks++;
    }
    this.context.logger.info(`Splitting PR comments into ${chunks} chunks`);

    for (const commentSplit of this._splitArrayToChunks(comments, chunks)) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(commentSplit), null, 2);
      const maxOutputTokens = this._calculateMaxTokens(dummyResponse);
      const promptForComments = this._generatePromptForPrComments(specification, commentSplit, dimension);

      for (const [key, value] of Object.entries(await this._submitPrompt(promptForComments, maxOutputTokens))) {
        if (commentRelevances[key]) {
          commentRelevances[key] = new Decimal(commentRelevances[key]).add(value).toNumber();
        } else {
          commentRelevances[key] = value;
        }
      }
    }
    for (const key of Object.keys(commentRelevances)) {
      commentRelevances[key] = new Decimal(commentRelevances[key]).div(chunks).toNumber();
    }

    return commentRelevances;
  }

  private async _evaluateIssueDimension(
    specification: string,
    username: string,
    userIssueComments: CommentToEvaluate[],
    allComments: AllComments,
    dimension: EvaluationDimension
  ): Promise<Relevances> {
    const dummyResponse = JSON.stringify(this._generateDummyResponse(userIssueComments), null, 2);
    const maxOutputTokens = this._calculateMaxTokens(dummyResponse);
    const promptForIssueComments = this._generatePromptForComments(specification, username, allComments, dimension);
    if (this._calculateMaxTokens(promptForIssueComments, Infinity) + maxOutputTokens > this._tokenLimit) {
      return this._splitPromptForIssueCommentEvaluation(
        specification,
        username,
        userIssueComments,
        allComments,
        dimension
      );
    }
    return this._submitPrompt(promptForIssueComments, maxOutputTokens);
  }

  private async _evaluatePrDimension(
    prSpecifications: string | string[],
    userPrComments: PrCommentToEvaluate[],
    dimension: EvaluationDimension
  ): Promise<Relevances> {
    const dummyResponse = JSON.stringify(this._generateDummyResponse(userPrComments), null, 2);
    const maxOutputTokens = this._calculateMaxTokens(dummyResponse);
    const promptForPrComments = this._generatePromptForPrComments(prSpecifications, userPrComments, dimension);
    if (this._calculateMaxTokens(promptForPrComments, Infinity) + maxOutputTokens > this._tokenLimit) {
      return this._splitPromptForPullRequestCommentEvaluation(prSpecifications, userPrComments, dimension);
    }
    return this._submitPrompt(promptForPrComments, maxOutputTokens);
  }

  private async _evaluateWeightedDimensions(
    expectedCommentIds: number[],
    evaluateDimension: (dimension: EvaluationDimension) => Promise<Relevances>
  ): Promise<Relevances> {
    const weights = this._getEvaluationWeights();
    const dimensions: EvaluationDimension[] = ["relevance", "helpfulness", "research"];
    const dimensionResults: Array<{ weight: number; scores: Relevances }> = [];

    for (const dimension of dimensions) {
      const weight = weights[dimension];
      if (weight <= 0) continue;
      const scores = await evaluateDimension(dimension);
      dimensionResults.push({ weight, scores });
    }

    return this._combineWeightedScores(dimensionResults, expectedCommentIds);
  }

  async _evaluateComments(
    specification: string,
    username: string,
    userIssueComments: CommentToEvaluate[],
    allComments: AllComments,
    userPrComments: PrCommentToEvaluate[]
  ): Promise<Relevances> {
    let commentRelevances: Relevances = {};
    let prCommentRelevances: Relevances = {};

    if (userIssueComments.length && !this.isPullRequest()) {
      commentRelevances = await this._evaluateWeightedDimensions(
        userIssueComments.map((comment) => comment.id),
        (dimension) => this._evaluateIssueDimension(specification, username, userIssueComments, allComments, dimension)
      );
    }

    if (userPrComments.length && this.isPullRequest()) {
      const closingIssueBodies = await this._getClosingIssueBodies();
      const prSpecifications: string | string[] = closingIssueBodies.length ? closingIssueBodies : specification;
      prCommentRelevances = await this._evaluateWeightedDimensions(
        userPrComments.map((comment) => comment.id),
        (dimension) => this._evaluatePrDimension(prSpecifications, userPrComments, dimension)
      );
    }

    if (
      (userIssueComments.length !== Object.keys(commentRelevances).length && !this.isPullRequest()) ||
      (userPrComments.length !== Object.keys(prCommentRelevances).length && this.isPullRequest())
    ) {
      this.context.logger.warn(
        `[_evaluateComments]: Result mismatch. Evaluated ${userIssueComments.length} user issue comments that gave ${Object.keys(commentRelevances).length} comment relevance, and ${userPrComments.length} that gave ${Object.keys(prCommentRelevances).length} pr comment relevance.`
      );
    }
    return { ...commentRelevances, ...prCommentRelevances };
  }

  /**
   * Fetches the bodies of all issues that the current pull request closes.
   * Returns an empty array if none are found or on failure.
   */
  private async _getClosingIssueBodies(): Promise<string[]> {
    try {
      if (!this.isPullRequest()) return [];

      const owner = this.context.payload.repository.owner.login;
      const repo = this.context.payload.repository.name;
      let pullNumber: number | undefined;
      if ("pull_request" in this.context.payload) {
        pullNumber = this.context.payload.pull_request.number;
      } else if ("issue" in this.context.payload && this.context.payload.issue.pull_request) {
        pullNumber = this.context.payload.issue.number;
      }
      if (!pullNumber) return [];

      const linked = await this.context.octokit.graphql.paginate<PullRequestClosingIssue>(LINKED_ISSUES, {
        owner,
        repo,
        pull_number: pullNumber,
      });
      const edges = linked.repository.pullRequest.closingIssuesReferences.edges ?? [];
      const bodies: string[] = [];
      for (const edge of edges) {
        const body = edge?.node?.body;
        if (body) bodies.push(body);
      }
      return bodies;
    } catch (e) {
      throw this.context.logger.warn("Failed to collect the closing issue's body for a linked issue.", { e });
    }
  }

  async _submitPrompt(prompt: string, maxTokens: number): Promise<Relevances> {
    try {
      const res = await callLlm(
        {
          response_format: { type: "json_object" },
          messages: [{ role: "system", content: prompt }],
          reasoning_effort: this._configuration?.openAi.reasoningEffort,
        },
        this.context
      );

      if (isAsyncIterable(res)) {
        throw this.context.logger.error("Unexpected streaming response from the LLM");
      }

      const answer = res.choices[0]?.message?.content;
      if (typeof answer !== "string" || !answer.trim()) {
        throw this.context.logger.error("Unexpected response format: Expected JSON string in message content");
      }

      const trimmedAnswer = answer.trim();

      let parsedJson: unknown;
      const parseErrors: unknown[] = [];

      try {
        parsedJson = JSON.parse(trimmedAnswer);
      } catch (e) {
        parseErrors.push(e);
        try {
          const extracted = extractFirstJsonObject(trimmedAnswer);
          this.context.logger.debug(`LLM extracted JSON (using max_tokens: ${maxTokens}): ${extracted}`);
          parsedJson = JSON.parse(extracted);
        } catch (e2) {
          parseErrors.push(e2);
          throw this.context.logger.error("Failed to parse a JSON object from the LLM response", {
            maxTokens,
            parseErrors,
            answerPreview: trimmedAnswer.slice(0, 500),
          });
        }
      }

      const relevances = Value.Decode(openAiRelevanceResponseSchema, parsedJson);
      this.context.logger.debug(`Relevances by the LLM: ${JSON.stringify(relevances)}`);
      return relevances;
    } catch (e) {
      this.context.logger.error(`Invalid response type received from the LLM while evaluating: \n\n${e}`, {
        error: e as Error,
      });
      throw e;
    }
  }

  private _getDimensionPromptCriteria(dimension: EvaluationDimension): {
    summary: string;
    zeroDescription: string;
    oneDescription: string;
    considerations: string[];
  } {
    switch (dimension) {
      case "helpfulness":
        return {
          summary: "Rank from 0 to 1 how helpful each comment is in helping and answering contributor questions.",
          zeroDescription: "0: Unhelpful, dismissive, or unrelated to contributor questions",
          oneDescription: "1: Directly answers contributor questions, unblocks contributors, or clarifies blockers",
          considerations: [
            "Clarity and accuracy in answering questions from other contributors",
            "Constructive guidance that unblocks implementation or debugging",
            "Responsiveness to confusion or edge-case questions in the conversation",
          ],
        };
      case "research":
        return {
          summary: "Rank from 0 to 1 how useful each comment is for adding research and insights to the project.",
          zeroDescription: "0: Adds no research, technical analysis, or actionable insights",
          oneDescription:
            "1: Provides valuable research, references, root-cause analysis, benchmarks, or architectural insights",
          considerations: [
            "Depth of technical investigation, root-cause discovery, or prior-art references",
            "Useful links, documentation findings, reproduction steps, or edge-case analysis",
            "Insights that improve long-term project understanding or design decisions",
          ],
        };
      case "relevance":
      default:
        return {
          summary: "Rank from 0 to 1 how relevant each comment is to solving the issue specification.",
          zeroDescription: "0: Not related (e.g., spam or off-topic noise)",
          oneDescription: "1: Highly relevant to solving the specification (e.g., solutions, bug reports)",
          considerations: [
            "Relation to the issue specification",
            "Connection to other comments",
            "Direct contribution to solving the issue",
          ],
        };
    }
  }

  _generateRelevancePromptForComments(issue: string, username: string, allComments: AllComments) {
    return this._generatePromptForComments(issue, username, allComments, "relevance");
  }

  _generateHelpfulnessPromptForComments(issue: string, username: string, allComments: AllComments) {
    return this._generatePromptForComments(issue, username, allComments, "helpfulness");
  }

  _generateResearchPromptForComments(issue: string, username: string, allComments: AllComments) {
    return this._generatePromptForComments(issue, username, allComments, "research");
  }

  _generatePromptForComments(
    issue: string,
    username: string,
    allComments: AllComments,
    dimension: EvaluationDimension = "relevance"
  ) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    const allCommentsMap = allComments
      // Sort by id to keep conversation in the original order
      .sort((a, b) => Number(a.id) - Number(b.id))
      .map((value) => `${value.id} - ${value.author}: "${value.comment}"`);
    const targetComments = allComments.filter((value) => value.author === username);
    if (!targetComments.length) {
      throw new Error(`No comments found for user ${username}`);
    }
    const targetCommentIds = targetComments.map((value) => value.id).join(", ");
    const criteria = this._getDimensionPromptCriteria(dimension);

    return `
      CRITICAL REQUIREMENT: YOUR RESPONSE MUST BE RAW JSON ONLY - NO BACKTICKS, NO CODE BLOCKS, NO MARKDOWN.
      
      Evaluate GitHub comments on an issue for the "${dimension}" dimension. ${criteria.summary} Focus exclusively on the comments authored by ${username}. Provide a raw JSON object with those comment IDs and their scores.

      Issue: ${issue}

      All comments:
      ${allCommentsMap.join("\n")}

      Instructions:
      1. Read all comments carefully, considering their context and content.
      2. Identify every comment authored by ${username}. Their comment IDs are: ${targetCommentIds}.
      3. Assign a score from 0 to 1 for each identified comment:
        - ${criteria.zeroDescription}
        - ${criteria.oneDescription}
      4. Consider:
        - ${criteria.considerations.join("\n        - ")}
      5. Handle GitHub-flavored markdown:
        - Ignore text beginning with '>' as it references another comment
        - Distinguish between referenced text and the commenter's own words
        - Only evaluate the commenter's original content
      6. Return only a JSON object mapping each comment ID authored by ${username} to its score, with the following structure: {"<comment_id_1>": <score>, "<comment_id_2>": <score>, ...}
      7. Do NOT wrap <score> in quotes. Each score must be a raw float (e.g., 0.85, not "0.85").

      Notes:
      - Even minor details may be significant.
      - Comments may reference earlier comments.
      - The number of entries in the JSON response MUST equal ${targetComments.length}.

      Example Output Format (for format only — not content): {${targetComments.map((o) => `"${o.id}": <score>`).join(", ")}}

      YOUR RESPONSE MUST CONTAIN ONLY THE RAW JSON OBJECT WITH NO FORMATTING, NO EXPLANATION, NO BACKTICKS, NO CODE BLOCKS.
    `;
  }

  _generatePromptForPrComments(
    specifications: string | string[],
    userComments: PrCommentToEvaluate[],
    dimension: EvaluationDimension = "relevance"
  ) {
    const specsArray = Array.isArray(specifications) ? specifications : [specifications];
    if (!specsArray.length || specsArray.every((s) => !s || s.length === 0)) {
      throw new Error("Issue specification comment is missing or empty");
    }
    const payload = { specification: specsArray, comments: userComments };
    const criteria = this._getDimensionPromptCriteria(dimension);
    return `CRITICAL REQUIREMENT: YOUR RESPONSE MUST BE RAW JSON ONLY - NO BACKTICKS, NO CODE BLOCKS, NO MARKDOWN.

    Evaluate the value of a GitHub contributor's comments in a pull request for the "${dimension}" dimension.
    ${criteria.summary}
    Context may include ONE OR MORE issue specifications. Treat the entire list as the set of problems this PR aims to solve.

    Scoring rules (0.0 - 1.0 per comment):
    - ${criteria.oneDescription}
    - 0.5: Somewhat helpful or partially aligned with this evaluation dimension, but limited in scope/impact.
    - ${criteria.zeroDescription}

    Additional notes:
    - Some comments are code-review entries and include a "diffHunk" representing the code context under review.
    - Prefer actionable, specific suggestions over generic praise.
    - Do not explain your reasoning; only output JSON.

    The following JSON contains the issue specification context and the comments to evaluate.
    The "specification" field is an array of one or more issue bodies; the "comments" array lists PR comments.

    ${JSON.stringify(payload)}

    Reply with ONLY a raw JSON object mapping each comment ID to a float between 0 and 1.
    The number of entries in the JSON response MUST equal ${userComments.length}.
    Example Output Format (for format only — not content): {${userComments.map((o) => `"${o.id}": <score>`).join(", ")}}
    Do NOT wrap <score> in quotes. Each score must be a raw float (e.g., 0.85, not "0.85").

    YOUR RESPONSE MUST CONTAIN ONLY THE RAW JSON OBJECT WITH NO FORMATTING, NO EXPLANATION, NO BACKTICKS, NO CODE BLOCKS.`;
  }
}
