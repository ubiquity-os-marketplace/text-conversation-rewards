import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { GitHubIssue, GitHubIssueComment, GitHubPullRequestReviewComment } from "../github-types";
import { Module, Result } from "./processor";

/**
 * Creates entries for each user with its associated comments.
 */
export class UserExtractorModule implements Module {
  private readonly _configuration = configuration["user-extractor"];

  get enabled(): boolean {
    return true;
  }

  /**
   * Checks if the comment is made by a human user, and not empty.
   */
  _checkEntryValidity(comment: GitHubIssueComment | GitHubPullRequestReviewComment) {
    return comment.body && comment.user?.type === "User";
  }

  _extractTaskPrice(issue: GitHubIssue) {
    if (this._configuration["redeem-task"] === false) {
      return 0;
    }
    const sortedPriceLabels = issue.labels
      .reduce((acc, label) => {
        const labelName = typeof label === "string" ? label : label.name;
        if (labelName?.startsWith("Price: ")) {
          const price = parseFloat(labelName.replace("Price: ", ""));
          if (!isNaN(price)) {
            acc.push(price);
          }
        }
        return acc;
      }, [] as number[])
      .sort((a, b) => a - b);
    if (!sortedPriceLabels.length) {
      console.warn("There are no price labels in this repository.");
      return 0;
    }
    return sortedPriceLabels[0];
  }

  transform(data: Readonly<GetActivity>, result: Result) {
    if (data.allComments) {
      for (const comment of data.allComments) {
        if (comment.user && comment.body && this._checkEntryValidity(comment)) {
          const task =
            (data.self as GitHubIssue)?.assignee?.id === comment.user.id
              ? {
                  reward: this._extractTaskPrice(data.self as GitHubIssue),
                }
              : undefined;
          result[comment.user.login] = {
            ...result[comment.user.login],
            total: 0,
            task,
          };
        }
      }
    }
    return Promise.resolve(result);
  }
}
