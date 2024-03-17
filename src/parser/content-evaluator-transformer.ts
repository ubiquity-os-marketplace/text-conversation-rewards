import { GetActivity } from "../get-activity";
import { Result, Transformer } from "./processor";

/**
 * Evaluates and rates comments.
 */
export class ContentEvaluatorTransformer implements Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result {
    for (const key of Object.keys(result)) {
      result[key].amount = 1;
    }
    return result;
  }
}
