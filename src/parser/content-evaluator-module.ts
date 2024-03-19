import OpenAI from "openai";
import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { GitHubIssue } from "../github-types";
import { Result, Module } from "./processor";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorModule implements Module {
  readonly _openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  readonly configuration = configuration.contentEvaluator;

  get enabled(): boolean {
    return this.configuration.enabled;
  }

  async transform(data: Readonly<GetActivity>, result: Result) {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const specificationBody = (data.self as GitHubIssue)?.body;
        const commentBody = comment.content;
        if (specificationBody && commentBody) {
          const { relevance } = await this._evaluateComment(specificationBody, commentBody);
          const reward = comment.score?.reward ? comment.score.reward * relevance : relevance;
          comments[i] = {
            ...comment,
            score: {
              ...comment.score,
              relevance,
              reward,
            },
          };
        }
      }
    }
    return result;
  }

  async _evaluateComment(specification: string, comment: string) {
    const prompt = this._generatePrompt(specification, comment);

    if (process.env.NODE_ENV === "test") {
      return {
        relevance: 0.5,
      };
    }

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

      return { relevance: Number(response.choices[0].message.content) };
    } catch (error) {
      console.error("Failed to evaluate comment", error);
      return {
        relevance: 0,
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
