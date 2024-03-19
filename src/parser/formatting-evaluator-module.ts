import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { Result, Module } from "./processor";
import MarkdownIt from "markdown-it";
import { JSDOM } from "jsdom";

export class FormattingEvaluatorModule implements Module {
  private readonly _configuration = configuration["formatting-evaluator"];
  private readonly _md = new MarkdownIt();

  transform(data: Readonly<GetActivity>, result: Result) {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        // Count with html elements if any, otherwise just treat it as plain text
        const { formatting } = this._getFormattingScore(comment.content);
        const formattingTotal = formatting
          ? Object.values(formatting).reduce(
              (acc, curr) => acc + curr.score * curr.count * curr.value * curr.multiplier,
              0
            )
          : 0;
        comment.score = {
          ...comment.score,
          formatting,
          reward: comment.score?.reward ? comment.score.reward + formattingTotal : formattingTotal,
        };
      }
    }
    return result;
  }

  get enabled(): boolean {
    return this._configuration?.enabled;
  }

  _getFormattingScore(content: string) {
    const html = this._md.render(content);
    const temp = new JSDOM(html);
    if (temp.window.document.body) {
      const res = this.classifyTagsWithWordCount(temp.window.document.body);
      return { formatting: res };
    }
    return { formatting: undefined };
  }

  _countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  classifyTagsWithWordCount(htmlElement: HTMLElement) {
    const tagWordCount: Record<string, { count: number; score: number; multiplier: number; value: number }> = {};
    const elements = htmlElement.getElementsByTagName("*");

    for (const element of elements) {
      const tagName = element.tagName.toLowerCase();
      const wordCount = this._countWords(element.textContent || "");
      let score = 1;
      let multiplier = 1;
      if (this._configuration?.scores?.[tagName] !== undefined) {
        score = this._configuration.scores[tagName];
      }
      if (this._configuration?.multipliers?.[tagName] !== undefined) {
        multiplier = this._configuration.multipliers[tagName];
      }
      tagWordCount[tagName] = {
        count: (tagWordCount[tagName]?.count || 0) + wordCount,
        score,
        multiplier,
        value: 1,
      };
    }

    return tagWordCount;
  }
}
