import axios from "axios";
import { GetActivity } from "../get-activity";
import { GitHubIssue } from "../github-types";
import { Result, Transformer } from "./processor";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorTransformer implements Transformer {
  async transform(data: Readonly<GetActivity>, result: Result): Promise<Result> {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      let totalReward = currentElement.totalReward;
      for (const comment of currentElement.comments) {
        const body = (data.self as GitHubIssue)?.body;
        if (body) {
          const { formatting, relevance } = await this._evaluateComments(body, comment.content);
          comment.relevance = relevance;
          comment.formatting = formatting;
          comment.reward = relevance * formatting;
          totalReward += comment.reward;
        }
      }
      currentElement.totalReward = totalReward;
    }
    return result;
  }

  async _evaluateComments(specification: string, comment: string) {
    console.log("Will compare");
    console.log(specification);
    console.log(comment);
    return {
      relevance: 0.75,
      formatting: 1,
    };
    try {
      const baseUrl = "https://api.openai.com/v1/completions";
      const apiKey = process.env.CHATGPT_KEY;
      const parameters = {
        model: "gpt-3.5-turbo",
        prompt: "",
        max_tokens: 150,
        n: 1,
        stop: ["\n"],
        temperature: 0.7,
      };

      parameters.prompt = comment;
      const response = await axios.post(baseUrl, parameters, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const generatedText = response.data.choices[0].text.trim();
      const wordCount = generatedText.split(/\s+/).length;
      const relevance = 1;
      const clarity = 1;

      console.log(`Comment: ${comment}`);
      console.log(`Generated Text: ${generatedText}`);
      console.log(`Word Count: ${wordCount}`);
      console.log(`Relevance: ${relevance}`);
      console.log(`Clarity: ${clarity}`);
      console.log("------------------------");
      return {
        relevance,
        formatting: clarity,
      };
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  }
}
