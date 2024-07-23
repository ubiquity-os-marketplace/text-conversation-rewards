import Decimal from "decimal.js";
import OpenAI from "openai";
import configuration from "../configuration/config-reader";
import { OPENAI_API_KEY } from "../configuration/constants";
import {
  ContentEvaluatorConfiguration,
  contentEvaluatorConfigurationType,
} from "../configuration/content-evaluator-config";
import { IssueActivity } from "../issue-activity";
import { GithubCommentScore, Module, Result } from "./processor";
import { Value } from "@sinclair/typebox/value";
import { CommentType } from "../configuration/comment-types";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule implements Module {
  readonly _openAi = new OpenAI({ apiKey: OPENAI_API_KEY });
  readonly _configuration: ContentEvaluatorConfiguration = configuration.incentives.contentEvaluator;

  get enabled(): boolean {
    if (!Value.Check(contentEvaluatorConfigurationType, this._configuration)) {
      console.warn("Invalid configuration detected for ContentEvaluatorModule, disabling.");
      return false;
    }
    return this._configuration.enabled;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const promises: Promise<GithubCommentScore[]>[] = [];

    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      const specificationBody = data.self?.body;

      if (specificationBody && comments.length) {
        promises.push(
          this._processComment(comments, specificationBody).then(
            (commentsWithScore) => (currentElement.comments = commentsWithScore)
          )
        );
      }
    }

    await Promise.all(promises);
    return result;
  }

  async _processComment(comments: Readonly<GithubCommentScore>[], specificationBody: string) {
    const commentsWithScore: GithubCommentScore[] = [...comments];

    const multipliers: { [k: string]: number } = this._commentTypeToRelevanceMap();

    // exclude comments that have fixed relevance. e.g. review comments = 1
    const commentsToEvaluate: { id: number; comment: string }[] = [];
    for (let i = 0; i < commentsWithScore.length; i++) {
      const currentComment = commentsWithScore[i];
      if (!multipliers[currentComment.type]) {
        commentsToEvaluate.push({
          id: currentComment.id,
          comment: currentComment.content,
        });
      }
    }

    const relevance = await this._evaluateComments(specificationBody, commentsToEvaluate);

    if (Object.keys(relevance).length !== commentsToEvaluate.length) {
      console.error("Relevance / Comment length mismatch! \nWill use 1 as relevance for missing comments.");
    }

    for (let i = 0; i < commentsWithScore.length; i++) {
      const currentComment = commentsWithScore[i];
      let currentRelevance = 1; // For comments not in fixed relevance types or missed by OpenAI evaluation

      if (multipliers[currentComment.type]) {
        currentRelevance = multipliers[currentComment.type];
      } else if (!isNaN(relevance[currentComment.id])) {
        currentRelevance = relevance[currentComment.id];
      }

      const currentReward = new Decimal(currentComment.score?.reward || 0);
      currentComment.score = {
        ...(currentComment.score || {}),
        relevance: new Decimal(currentRelevance).toNumber(),
        reward: currentReward.mul(currentRelevance).toNumber(),
      };
    }

    return commentsWithScore;
  }

  _commentTypeToRelevanceMap(): { [k: string]: number } {
    const multipliers: { [k: string]: number } = {};
    this._configuration.multipliers.forEach((multiplier) => {
      let key = 0;
      multiplier.targets.forEach((target) => {
        key |= CommentType[target as keyof typeof CommentType];
      });

      if (multiplier.relevance !== undefined) {
        multipliers[key as unknown as string] = multiplier.relevance;
      }
    });
    return multipliers;
  }

  async _evaluateComments(
    specification: string,
    comments: { id: number; comment: string }[]
  ): Promise<{ [k: string]: number }> {
    const prompt = this._generatePrompt(specification, comments);

    try {
      const response: OpenAI.Chat.ChatCompletion = await this._openAi.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: prompt,
          },
        ],
        temperature: 1,
        max_tokens: 128,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      const rawResponse = String(response.choices[0].message.content);
      return JSON.parse(rawResponse) as { [k: string]: number };
    } catch (error) {
      console.error(`Failed to evaluate comment`, error);
      return {};
    }
  }

  _generatePrompt(issue: string, comments: { id: number; comment: string }[]) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the relevance of GitHub contributors' comments to a specific issue specification. Specifically, I'm interested in how much each comment helps to further define the issue specification or contributes new information or research relevant to the issue. Please provide a float between 0 and 1 to represent the degree of relevance. A score of 1 indicates that the comment is entirely relevant and adds significant value to the issue, whereas a score of 0 indicates no relevance or added value. A stringified JSON is given below that contains the specification and contributors' comments. Each comment in the JSON has a unique ID and comment content. \n\n\`\`\`\n${JSON.stringify(
      { specification: issue, comments: comments }
    )}\n\`\`\`\n\n\nTo what degree are each of the comments in the conversation relevant and valuable to further defining the issue specification? Please reply with ONLY a JSON where each key is the comment ID given in JSON above, and the value is a float number between 0 and 1 corresponding to the comment. The float number should represent the degree of relevance and added value of the comment to the issue. The total number of properties in your JSON response should equal exactly ${
      comments.length
    }.`;
  }
}
