import Decimal from "decimal.js";
import { encodingForModel } from "js-tiktoken";
import OpenAI from "openai";
import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { GitHubIssue } from "../github-types";
import { GithubComment, Module, Result } from "./processor";

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
    const promises: Promise<void>[] = [];

    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      const specificationBody = (data.self as GitHubIssue)?.body;

      if (specificationBody && comments.length) {
        promises.push(
          this._processComment(
            comments,
            specificationBody,
            comments.map((comment) => comment.content)
          )
        );
      }
    }

    await Promise.all(promises);
    return result;
  }

  async _processComment(comments: GithubComment[], specificationBody: string, commentsBody: string[]) {
    const relevance = await this._sampleRelevanceScoreResults(specificationBody, commentsBody);

    for (let i = 0; i < relevance.length; i++) {
      const currentComment = comments[i];
      const currentRelevance = relevance[i];
      const currentReward = new Decimal(currentComment.score?.reward ? currentComment.score.reward : 0);
      currentComment.score = {
        ...(currentComment.score || {}),
        relevance: currentRelevance.toNumber(),
        reward: currentReward.mul(currentRelevance).toNumber(),
      };
    }
  }

  async _evaluateComments(specification: string, comments: string[]) {
    const prompt = this._generatePrompt(specification, comments);

    try {
      const response: OpenAI.Chat.ChatCompletion = await this._openAi.chat.completions.create({
        model: this._getOptimalModel(prompt),
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
      const parsedResponse = JSON.parse(rawResponse) as number[];
      return parsedResponse.map((o) => new Decimal(o));
    } catch (error) {
      console.error(`Failed to evaluate comment`, error);
      return [];
    }
  }

  _getOptimalModel(prompt: string) {
    const encoder = encodingForModel("gpt-3.5-turbo");
    const totalSumOfTokens = encoder.encode(prompt).length;

    if (totalSumOfTokens <= 4097) {
      return "gpt-3.5-turbo";
    } else if (totalSumOfTokens <= 16385) {
      return "gpt-3.5-turbo-16k";
    } else {
      console.warn("Backup plan for development purposes only, but using gpt-4 due to huge context size");
      return "gpt-4";
    }
  }

  async _sampleRelevanceScoreResults(specification: string, comments: string[]) {
    const BATCH_SIZE = 10;
    const evaluationPromises: ReturnType<typeof this._evaluateComments>[] = [];

    for (let i = 0; i < BATCH_SIZE; ++i) {
      evaluationPromises.push(this._evaluateComments(specification, comments));
    }

    const results = await Promise.all(evaluationPromises);

    // Calculate the sum of each column
    const columnSums: Decimal[] = [];
    for (let j = 0; j < results[0].length; j++) {
      let sum = new Decimal(0);
      for (let i = 0; i < results.length; i++) {
        sum = sum.plus(results[i][j]);
      }
      columnSums.push(sum);
    }

    // Return the average of each column
    return columnSums.map((sum) => sum.dividedBy(results.length));
  }

  _generatePrompt(issue: string, comments: string[]) {
    if (!issue?.length) {
      throw new Error("Issue specification comment is missing or empty");
    }
    return `I need to evaluate the relevance of GitHub contributors' comments to a specific issue specification. Specifically, I'm interested in how much each comment helps to further define the issue specification or contributes new information or research relevant to the issue. Please provide a float between 0 and 1 to represent the degree of relevance. A score of 1 indicates that the comment is entirely relevant and adds significant value to the issue, whereas a score of 0 indicates no relevance or added value. Each contributor's comment is on a new line.\n\nIssue Specification:\n\`\`\`\n${issue}\n\`\`\`\n\nConversation:\n\`\`\`\n${comments
      .map((comment) => comment)
      .join(
        "\n"
      )}\n\`\`\`\n\n\nTo what degree are each of the comments in the conversation relevant and valuable to further defining the issue specification? Please reply with ONLY an array of float numbers between 0 and 1, corresponding to each comment in the order they appear. Each float should represent the degree of relevance and added value of the comment to the issue. The total length of the array in your response should equal exactly ${
      comments.length
    } elements.`;
  }
}
