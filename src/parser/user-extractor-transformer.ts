import { GetActivity } from "../get-activity";
import { GitHubIssueComment } from "../github-types";
import { Result, Transformer } from "./processor";

/**
 * Creates entries for each bounty hunter with its associated comments.
 */
export class UserExtractorTransformer implements Transformer {
  /**
   * Checks if the comment is made by a human user, and if it not a command.
   * @param comment
   */
  _checkCommentValidity(comment: GitHubIssueComment) {
    return !!comment.user && !!comment.body && comment.user?.type === "User" && !/^\/s+/.test(comment.body);
  }

  transform(data: Readonly<GetActivity>, result: Result): Result {
    if (data.comments) {
      for (const comment of data.comments as GitHubIssueComment[]) {
        if (comment.user && comment.body && this._checkCommentValidity(comment)) {
          result[comment.user.login] = {
            ...result[comment.user.login],
            comments: [...(result[comment.user.login]?.comments ?? []), { content: comment.body, formatting: 0, relevance: 0, reward: 0 }],
          };
        }
      }
    }
    return result;
  }
}
