import Decimal from "decimal.js";
import { UserExtractorConfiguration } from "../configuration/user-extractor-config";
import { GitHubIssue } from "../github-types";
import { getSortedPrices } from "../helpers/label-price-extractor";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { Result } from "../types/results";

/**
 * Creates entries for each user with its associated comments.
 */
export class UserExtractorModule extends BaseModule {
  private readonly _configuration: UserExtractorConfiguration | null = this.context.config.incentives.userExtractor;

  get enabled(): boolean {
    if (!this._configuration) {
      this.context.logger.warn(
        "The configuration for the module UserExtractorModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }

  /**
   * Checks if the comment is made by a human user, not empty, and not a command.
   */
  _checkEntryValidity(comment: Awaited<ReturnType<IssueActivity["getAllComments"]>>[0]) {
    return comment.body && comment.user?.type === "User" && !comment.body.trim().startsWith("/");
  }

  /**
   * Gets the price from the labels, except if the configuration disables the redeem
   */
  _extractTaskPrice(issue: GitHubIssue) {
    if (this._configuration?.redeemTask === false) {
      return 0;
    }
    const sortedPriceLabels = getSortedPrices(issue.labels);
    if (!sortedPriceLabels.length) {
      console.warn("There are no price labels in this repository.");
      return 0;
    }
    return sortedPriceLabels[0];
  }

  _getTaskMultiplier(issue: GitHubIssue) {
    return new Decimal(1).div(issue.assignees?.length ?? 1);
  }

  _addEventAnchorToHtmlUrl(url: string, id: string) {
    if (url.includes("#")) {
      const anchorIndex = url.lastIndexOf("-");
      if (anchorIndex !== -1) {
        return url.substring(0, anchorIndex + 1) + id;
      } else {
        const hashIndex = url.lastIndexOf("#");
        return url.substring(0, hashIndex + 1) + "event-" + id;
      }
    } else {
      return url + "#event-" + id;
    }
  }

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const closedEvents = data.events?.filter((event) => event.event === "closed") ?? [];
    let taskTimestamp: string;
    let taskUrl: string;
    if (closedEvents.length > 0) {
      closedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      taskTimestamp = closedEvents[0].created_at;
      taskUrl = this._addEventAnchorToHtmlUrl(`${data.self?.html_url}`, closedEvents[0].id.toString());
    } else {
      taskTimestamp = new Date().toISOString();
      taskUrl = `${data.self?.html_url}`;
    }

    // First, try to add all assignees as they didn't necessarily add a comment but should receive a reward
    data.self?.assignees?.forEach((assignee) => {
      const task = data.self
        ? {
            reward: new Decimal(this._extractTaskPrice(data.self)).mul(this._getTaskMultiplier(data.self)).toNumber(),
            multiplier: this._getTaskMultiplier(data.self).toNumber(),
            timestamp: taskTimestamp,
            url: taskUrl,
          }
        : undefined;
      result[assignee.login] = {
        ...result[assignee.login],
        userId: assignee.id,
        total: 0,
        task,
      };
    });
    const allComments = await data.getAllComments();
    for (const comment of allComments) {
      if (comment.user && comment.body && this._checkEntryValidity(comment)) {
        result[comment.user.login] = {
          ...result[comment.user.login],
          total: 0,
          userId: comment.user.id,
        };
      }
    }
    return result;
  }
}
