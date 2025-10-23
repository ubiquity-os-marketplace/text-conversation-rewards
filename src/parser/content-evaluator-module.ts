import { TypeBoxError } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { LogReturn } from "@ubiquity-os/ubiquity-os-logger";
import Decimal from "decimal.js";
import { encodingForModel } from "js-tiktoken";
import OpenAI from "openai";
import { CommentAssociation, commentEnum, CommentKind, CommentType } from "../configuration/comment-types";
import { ContentEvaluatorConfiguration } from "../configuration/content-evaluator-config";
import { extractOriginalAuthor } from "../helpers/original-author";
import { checkLlmRetryableState, retry } from "../helpers/retry";
import { IssueActivity } from "../issue-activity";
import {
  AllComments,
  CommentToEvaluate,
  openAiRelevanceResponseSchema,
  PrCommentToEvaluate,
  Relevances,
} from "../types/content-evaluator-module-type";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { LINKED_ISSUES, PullRequestClosingIssue } from "../types/requests";
import { GithubCommentScore, Result } from "../types/results";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule extends BaseModule {
  readonly _configuration: ContentEvaluatorConfiguration | null = this.context.config.incentives.contentEvaluator;
  readonly _openAi = new OpenAI({
    apiKey: this.context.env.OPENROUTER_API_KEY,
    ...(this._configuration?.openAi.endpoint && { baseURL: this._configuration.openAi.endpoint }),
  });
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

  async _getRateLimitTokens() {
    const res = await this._openAi.chat.completions
      .create({
        model: this._configuration?.openAi.model ?? "gpt-4o-2024-08-06",
        messages: [{ role: "system", content: "a" }],
        max_tokens: 1,
      })
      .asResponse();
    const tokenLimit = res.headers.get("x-ratelimit-limit-tokens");
    return tokenLimit && Number.isFinite(Number(tokenLimit)) ? Number(tokenLimit) : Infinity;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    if (!this._configuration?.openAi.tokenCountLimit) {
      throw this.context.logger.fatal("Token count limit is missing, comments cannot be evaluated.");
    }
    this._tokenLimit = Math.min(this._configuration?.openAi.tokenCountLimit, await this._getRateLimitTokens());
    this.context.logger.info(`Using token limit: ${this._tokenLimit}`);

    const promises: Promise<GithubCommentScore[]>[] = [];
    this._basePriority = await this.computePriority(data);
    const allComments: { id: number; comment: string; author: string }[] = [];

    for (const [user, data] of Object.entries(result)) {
      if (data.comments?.length) {
        allComments.push(
          ...data.comments
            .filter((comment) => comment.commentType & CommentKind.ISSUE)
            .map((comment) => ({ id: comment.id, comment: comment.content, author: user }))
        );
      }
    }

    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments ?? [];
      const specificationBody = data.self?.body;

      if (specificationBody && comments.length) {
        promises.push(
          this._processComment(key, comments, specificationBody, allComments).then(
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
    userId: string,
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
          userId,
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
          this.context.logger.error(String(error), { err: error });
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

  async _splitPromptForIssueCommentEvaluation(
    specification: string,
    userId: string,
    comments: CommentToEvaluate[],
    allComments: AllComments
  ) {
    const commentRelevances: Relevances = {};
    const evaluationCounts: Record<string, number> = {};

    const dummyResponseAll = JSON.stringify(this._generateDummyResponse(comments), null, 2);
    const maxOutputTokensAll = this._calculateMaxTokens(dummyResponseAll);

    let chunks = 2;
    while (true) {
      const chunkTokenEstimates = this._splitArrayToChunks(allComments, chunks)
        .map((chunk) => {
          if (!chunk.some((comment) => comment.author === userId)) {
            return 0;
          }
          return this._calculateMaxTokens(this._generatePromptForComments(specification, userId, chunk), Infinity);
        })
        .filter((value) => value > 0);
      const maxChunkTokens = chunkTokenEstimates.length ? Math.max(...chunkTokenEstimates) : 0;
      if (!chunkTokenEstimates.length || maxOutputTokensAll + maxChunkTokens <= this._tokenLimit) {
        break;
      }
      chunks++;
    }
    this.context.logger.debug(`Splitting issue comments into ${chunks} chunks`);

    for (const commentSplit of this._splitArrayToChunks(allComments, chunks)) {
      const targetComments = commentSplit.filter((comment) => comment.author === userId);
      if (!targetComments.length) {
        continue;
      }
      const dummyResponse = JSON.stringify(this._generateDummyResponse(targetComments), null, 2);
      const maxOutputTokens = this._calculateMaxTokens(dummyResponse);
      const promptForComments = this._generatePromptForComments(specification, userId, commentSplit);

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

  async _splitPromptForPullRequestCommentEvaluation(specification: string | string[], comments: PrCommentToEvaluate[]) {
    const commentRelevances: Relevances = {};

    let chunks = 2;
    while (
      Math.max(
        ...this._splitArrayToChunks(comments, chunks).map(
          (chunk) =>
            this._calculateMaxTokens(JSON.stringify(this._generateDummyResponse(chunk), null, 2)) +
            this._calculateMaxTokens(this._generatePromptForPrComments(specification, chunk), Infinity)
        )
      ) > this._tokenLimit
    ) {
      chunks++;
    }
    this.context.logger.info(`Splitting PR comments into ${chunks} chunks`);

    for (const commentSplit of this._splitArrayToChunks(comments, chunks)) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(commentSplit), null, 2);
      const maxOutputTokens = this._calculateMaxTokens(dummyResponse);
      const promptForComments = this._generatePromptForPrComments(specification, commentSplit);

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

  async _evaluateComments(
    specification: string,
    userId: string,
    userIssueComments: CommentToEvaluate[],
    allComments: AllComments,
    userPrComments: PrCommentToEvaluate[]
  ): Promise<Relevances> {
    let commentRelevances: Relevances = {};
    let prCommentRelevances: Relevances = {};

    if (userIssueComments.length && !this.isPullRequest()) {
      const dummyResponse = JSON.stringify(this._generateDummyResponse(userIssueComments), null, 2);
      const maxOutputTokens = this._calculateMaxTokens(dummyResponse);

      const promptForIssueComments = this._generatePromptForComments(specification, userId, allComments);
      if (this._calculateMaxTokens(promptForIssueComments, Infinity) + maxOutputTokens > this._tokenLimit) {
        commentRelevances = await this._splitPromptForIssueCommentEvaluation(
          specification,
          userId,
          userIssueComments,
          allComments
        );
      } else {
        commentRelevances = await this._submitPrompt(promptForIssueComments, maxOutputTokens);
      }
    }

    if (userPrComments.length && this.isPullRequest()) {
      // Build PR specification context from all closing issues (fallback to provided specification if none)
      const closingIssueBodies = await this._getClosingIssueBodies();
      const prSpecifications: string | string[] = closingIssueBodies.length ? closingIssueBodies : specification;
      const dummyResponse = JSON.stringify(this._generateDummyResponse(userPrComments), null, 2);
      const maxOutputTokens = this._calculateMaxTokens(dummyResponse);

      const promptForPrComments = this._generatePromptForPrComments(prSpecifications, userPrComments);
      if (this._calculateMaxTokens(promptForPrComments, Infinity) + maxOutputTokens > this._tokenLimit) {
        prCommentRelevances = await this._splitPromptForPullRequestCommentEvaluation(prSpecifications, userPrComments);
      } else {
        prCommentRelevances = await this._submitPrompt(promptForPrComments, maxOutputTokens);
      }
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
      const res = await this._openAi.chat.completions.create({
        model: this._configuration?.openAi.model ?? "gpt-4o-2024-08-06",
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        top_p: 1,
        temperature: 0.5,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      // Strip any potential Markdown formatting like ```json or ``` from the response, because some LLMs love do to so
      const rawResponse = String(res.choices[0].message.content).replace(/^.*?{/, "{").replace(/}.*$/, "}");

      this.context.logger.debug(`LLM raw response (using max_tokens: ${maxTokens}): ${rawResponse}`);

      const relevances = Value.Decode(openAiRelevanceResponseSchema, JSON.parse(rawResponse));
      this.context.logger.debug(`Relevances by the LLM: ${JSON.stringify(relevances)}`);
      return relevances;
    } catch (e) {
      this.context.logger.error(`Invalid response type received from the LLM while evaluating: \n\n${e}`, {
        error: e as Error,
      });
      throw e;
    }
  }

  _generatePromptForComments(issue: string, userId: string, allComments: AllComments) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    const allCommentsMap = allComments.map((value) => `${value.id} - ${value.author}: "${value.comment}"`);
    const targetComments = allComments.filter((value) => value.author === userId);
    if (!targetComments.length) {
      throw new Error(`No comments found for user ${userId}`);
    }
    const targetCommentIds = targetComments.map((value) => value.id).join(", ");

    return `
      CRITICAL REQUIREMENT: YOUR RESPONSE MUST BE RAW JSON ONLY - NO BACKTICKS, NO CODE BLOCKS, NO MARKDOWN.
      
      Evaluate the relevance of GitHub comments to an issue. Focus exclusively on the comments authored by ${userId}. Provide a raw JSON object with those comment IDs and their relevance scores.

      Issue: ${issue}

      All comments:
      ${allCommentsMap.join("\n")}

      Instructions:
      1. Read all comments carefully, considering their context and content.
      2. Identify every comment authored by ${userId}. Their comment IDs are: ${targetCommentIds}.
      3. Assign a relevance score from 0 to 1 for each identified comment:
        - 0: Not related (e.g., spam)
        - 1: Highly relevant (e.g., solutions, bug reports)
      4. Consider:
        - Relation to the issue description
        - Connection to other comments
        - Contribution to issue resolution
      5. Handle GitHub-flavored markdown:
        - Ignore text beginning with '>' as it references another comment
        - Distinguish between referenced text and the commenter's own words
        - Only evaluate the relevance of the commenter's original content
      6. Return only a JSON object mapping each comment ID authored by ${userId} to its score, like this example: {"123": 0.8, "456": 0.2, "789": 1.0}

      Notes:
      - Even minor details may be significant.
      - Comments may reference earlier comments.
      - The number of entries in the JSON response MUST equal ${targetComments.length}.

      Example Output Format: {"commentId1": 0.75, "commentId2": 0.3, "commentId3": 0.9}

      YOUR RESPONSE MUST CONTAIN ONLY THE RAW JSON OBJECT WITH NO FORMATTING, NO EXPLANATION, NO BACKTICKS, NO CODE BLOCKS.
    `;
  }

  _generatePromptForPrComments(specifications: string | string[], userComments: PrCommentToEvaluate[]) {
    const specsArray = Array.isArray(specifications) ? specifications : [specifications];
    if (!specsArray.length || specsArray.every((s) => !s || s.length === 0)) {
      throw new Error("Issue specification comment is missing or empty");
    }
    const payload = { specification: specsArray, comments: userComments };
    return `CRITICAL REQUIREMENT: YOUR RESPONSE MUST BE RAW JSON ONLY - NO BACKTICKS, NO CODE BLOCKS, NO MARKDOWN.

    Evaluate the value of a GitHub contributor's comments in a pull request.
    Context may include ONE OR MORE issue specifications. Treat the entire list as the set of problems this PR aims to solve.
    Consider a comment valuable if it helps address ANY of the specifications and/or clearly improves code quality while staying aligned with them.

    Scoring rules (0.0 - 1.0 per comment):
    - 1.0: Strongly advances a fix/feature tied to one or more specifications, or significantly improves correctness, safety, performance, or maintainability in direct relation to the specs.
    - 0.5: Somewhat helpful or partially relevant; raises a valid concern or improvement but limited in scope/impact.
    - 0.0: Not relevant, incorrect, or off-topic with respect to the specifications; noise.

    Additional notes:
    - Some comments are code-review entries and include a "diffHunk" representing the code context under review.
    - Prefer actionable, specific suggestions over generic praise.
    - Do not explain your reasoning; only output JSON.

    The following JSON contains the issue specification context and the comments to evaluate.
    The "specification" field is an array of one or more issue bodies; the "comments" array lists PR comments.

    ${JSON.stringify(payload)}

    Reply with ONLY a raw JSON object mapping each comment ID to a float between 0 and 1.
    The number of entries in the JSON response MUST equal ${userComments.length}.
    Example Output Format: {"123": 0.75, "456": 0.3, "789": 0.9}

    YOUR RESPONSE MUST CONTAIN ONLY THE RAW JSON OBJECT WITH NO FORMATTING, NO EXPLANATION, NO BACKTICKS, NO CODE BLOCKS.`;
  }
}
