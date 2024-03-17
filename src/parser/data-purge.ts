import { GetActivity } from "../get-activity";
import { Result, Transformer } from "./processor";

export class DataPurgeTransformer implements Transformer {
  transform(data: GetActivity, result: Result): Result {
    return { ...Object.entries(result).filter((o) => o[1].comment) };
  }
}
