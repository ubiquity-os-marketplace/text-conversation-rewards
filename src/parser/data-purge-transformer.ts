import { GetActivity } from "../get-activity";
import { Result, Transformer } from "./processor";

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeTransformer implements Transformer {
  transform(data: Readonly<GetActivity>, result: Result): Result {
    const purgedResult: Result = {};
    for (const [key, value] of Object.entries(result)) {
      if (value) {
        const sanitizedComments = value.comments.map(({ content, ...rest }) => ({
          ...rest,
          content: content
            .replace(/^>.*$/gm, "")
            .replace(/[\r\n]+/g, " ")
            .replace(/\[.*?\]\(.*?\)/g, "")
            .trim(),
        }));
        purgedResult[key] = {
          ...value,
          comments: sanitizedComments,
        };
      }
    }
    return purgedResult;
  }
}
