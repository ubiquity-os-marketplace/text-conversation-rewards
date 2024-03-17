import { GetActivity } from "../get-activity";
import { GitHubIssueComment } from "../github-types";
import { Result, Transformer } from "./processor";

export class UserExtractorTransformer implements Transformer {
  transform(data: GetActivity, result: Result): Result {
    if (data.comments) {
      for (const comment of data.comments as GitHubIssueComment[]) {
        if (comment.user && comment.body_text) {
          result[comment.user.login] = { comment: comment.body_text };
        }
      }
    }
    return result;
  }
}
