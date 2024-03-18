import OpenAI from "openai";
import { GetActivity } from "../get-activity";
import { GitHubIssue, GitHubIssueComment } from "../github-types";
import { Result, Transformer } from "./processor";
import configuration from "../configuration/config-reader";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorTransformer implements Transformer {
  readonly _openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  readonly configuration = configuration["content-evaluator"];

  get enabled(): boolean {
    return this.configuration.enabled;
  }

  async transform(data: Readonly<GetActivity>, result: Result): Promise<Result> {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = (data.comments as GitHubIssueComment[]).filter((o) => o.user?.login === key);
      currentElement.comments = [];
      for (const comment of comments) {
        const body = (data.self as GitHubIssue)?.body;
        const commentBody = comment?.body;
        if (body && commentBody) {
          const { formatting, relevance } = await this._evaluateComment(body, commentBody);
          currentElement.comments.push({
            relevance,
            formatting,
            reward: relevance * formatting,
            content: commentBody,
          });
          currentElement.totalReward += relevance * formatting;
        }
      }
    }
    return result;
  }

  async _evaluateComment(specification: string, comment: string) {
    const prompt = this._generatePrompt(specification, comment);

    try {
      const response: OpenAI.Chat.ChatCompletion = await this._openAi.chat.completions.create({
        model: "gpt-3.5-turbo",
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

      return { relevance: Number(response.choices[0].message.content), formatting: 1 };
    } catch (error) {
      console.error("Failed to evaluate comment", error);
      return {
        relevance: 0,
        formatting: 0,
      };
    }
  }

  _generatePrompt(issue: string, comments: string) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the relevance of GitHub contributors' comments to a specific issue specification. Specifically, I'm interested in how much the comment helps to further define the issue specification or contributes new information or research relevant to the issue. Please provide a float between 0 and 1 to represent the degree of relevance. A score of 1 indicates that the comment is entirely relevant and adds significant value to the issue, whereas a score of 0 indicates no relevance or added value.\n\nIssue Specification:\n\`\`\`\n${issue}\n\`\`\`\n\nConversation:\n\`\`\`\n${comments}\n\`\`\`\n\n\nTo what degree is of the comment in the conversation relevant and valuable to further defining the issue specification? Please reply ONLY with a float number between 0 and 1. The float should represent the degree of relevance and added value of the comment to the issue.`;
  }
}
