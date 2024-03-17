import { GetActivity } from "../get-activity";
import { Result, Transformer } from "./processor";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorTransformer implements Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result {
    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      currentElement.totalReward = currentElement.comments.reduce((acc, curr) => {
        curr.relevance = 5;
        curr.formatting = 2;
        curr.reward = curr.relevance * curr.formatting;
        return acc + curr.reward;
      }, 0);
    }
    return result;
  }
}
