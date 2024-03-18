import { GetActivity } from "../get-activity";
import { GitHubIssue, GitHubIssueComment } from "../github-types";
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

  _extractBountyPrice(issue: GitHubIssue) {
    const priceLabels = issue.labels.filter((label) => label.name.startsWith("Price: "));
    if (!priceLabels.length) {
      console.warn("There are no price labels in this repository.");
      return 0;
    }
    const sortedPriceLabels = priceLabels.sort((a, b) => {
      const priceA = parseFloat(a.name.replace("Price: ", ""));
      const priceB = parseFloat(b.name.replace("Price: ", ""));
      return priceA - priceB;
    });
    const smallestPriceLabel = sortedPriceLabels[0];
    const priceLabelName = smallestPriceLabel.name;
    const priceLabelMatch = priceLabelName.match(/\d+(\.\d+)?/);
    const priceLabel = priceLabelMatch?.shift();

    if (!priceLabel) {
      console.warn("Price label is undefined");
      return 0;
    }
    return Number(priceLabel);
  }

  transform(data: Readonly<GetActivity>, result: Result): Result {
    if (data.comments) {
      for (const comment of data.comments as GitHubIssueComment[]) {
        if (comment.user && comment.body && this._checkCommentValidity(comment)) {
          result[comment.user.login] = {
            ...result[comment.user.login],
            totalReward:
              (data.self as GitHubIssue)?.user?.id === comment.user.id
                ? this._extractBountyPrice(data.self as GitHubIssue)
                : 0,
            comments: [
              ...(result[comment.user.login]?.comments ?? []),
              { content: comment.body, formatting: 0, relevance: 0, reward: 0 },
            ],
          };
        }
      }
    }
    return result;
  }
}
