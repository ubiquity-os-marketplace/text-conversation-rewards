import { GetActivity } from "../get-activity";
import { GitHubIssueComment } from "../github-types";
import { Result, Transformer } from "./processor";

/**
 * Creates entries for each bounty hunter with its associated comments.
 */
export class UserExtractorTransformer implements Transformer {
  _checkCommentValidity(comment: GitHubIssueComment) {
    return comment.user && comment.body && comment.user?.type === "User" && !/^\/s+/.test(comment.body);
  }

  transform(data: Readonly<GetActivity>, result: Result): Result {
    if (data.comments) {
      for (const comment of data.comments as GitHubIssueComment[]) {
        if (comment.user && comment.body && this._checkCommentValidity(comment)) {
          result[comment.user.login] = {
            ...result[comment.user.login],
            comments: [...(result[comment.user.login]?.comments ?? []), comment.body],
          };
        }
      }
    }
    return result;
  }
}
