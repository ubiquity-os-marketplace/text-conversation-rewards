import configuration from "../configuration/config-reader";
import { GetActivity } from "../get-activity";
import { GitHubIssue, GitHubIssueComment } from "../github-types";
import { Result, Transformer } from "./processor";

/**
 * Creates entries for each bounty hunter with its associated comments.
 */
export class UserExtractorTransformer implements Transformer {
  private readonly _configuration = configuration["user-extractor"];

  get enabled(): boolean {
    return true;
  }

  /**
   * Checks if the comment is made by a human user, and if it not a command.
   * @param comment
   */
  _checkEntryValidity(comment: GitHubIssueComment) {
    return !!comment.user && !!comment.body && comment.user.type === "User";
  }

  _extractBountyPrice(issue: GitHubIssue) {
    if (this._configuration["redeem-bounty"] === false) {
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
      }, [] as Array<number>)
      .sort((a, b) => {
        return a - b;
      });
    if (!sortedPriceLabels.length) {
      console.warn("There are no price labels in this repository.");
      return 0;
    }
    return sortedPriceLabels[0];
  }

  transform(data: Readonly<GetActivity>, result: Result): Result {
    if (data.comments) {
      for (const comment of data.comments as GitHubIssueComment[]) {
        if (comment.user && comment.body && this._checkEntryValidity(comment)) {
          const bounty =
            (data.self as GitHubIssue)?.assignee?.id === comment.user.id
              ? {
                  reward: this._extractBountyPrice(data.self as GitHubIssue),
                }
              : undefined;
          result[comment.user.login] = {
            ...result[comment.user.login],
            bounty,
          };
        }
      }
    }
    return result;
  }
}
