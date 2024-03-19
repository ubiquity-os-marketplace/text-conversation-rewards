import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { Result, Transformer } from "./processor";

export class FormattingEvaluatorTransformer implements Transformer {
  private readonly _configuration = configuration["formatting-evaluator"];
  transform(data: Readonly<GetActivity>, result: Result) {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const comments = currentElement.comments || [];
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        // Count with html elements if any, otherwise just treat it as plain text
        const { formatting } = this._getFormattingScore(comment.contentHtml || comment.content);
        comment.score = {
          ...comment.score,
          formatting,
          reward: comment.score?.reward ? comment.score.reward + formatting : formatting,
        };
      }
    }
    return result;
  }

  get enabled(): boolean {
    return this._configuration?.enabled;
  }

  _getFormattingScore(content: string) {
    return { formatting: content.split(" ").length };
  }
}
