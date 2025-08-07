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

  _addEventAnchorToHtmlUrl(url: string, id: string): string {
    const hashIndex = url.indexOf("#");
    const baseUrl = hashIndex >= 0 ? url.substring(0, hashIndex) : url;
    return `${baseUrl}#event-${id}`;
  }

  _getTaskTimestampAndUrl(data: Readonly<IssueActivity>) {
    const closedEvents = data.events?.filter((event) => event.event === "closed") ?? [];
    if (closedEvents.length > 0) {
      closedEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return {
        timestamp: closedEvents[0].created_at,
        url: this._addEventAnchorToHtmlUrl(`${data.self?.html_url}`, closedEvents[0].id.toString()),
      };
    }
    return {
      timestamp: new Date().toISOString(),
      url: `${data.self?.html_url}`,
    };
  }

  _createTaskReward(issue: GitHubIssue, timestamp: string, url: string) {
    return {
      reward: new Decimal(this._extractTaskPrice(issue)).mul(this._getTaskMultiplier(issue)).toNumber(),
      multiplier: this._getTaskMultiplier(issue).toNumber(),
      timestamp,
      url,
    };
  }

  _addUserToResult(result: Result, login: string, userId: number, task?: ReturnType<typeof this._createTaskReward>) {
    if (result[login]) {
      return;
    }
    result[login] = {
      userId,
      total: 0,
      task,
    };
  }

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const { timestamp: taskTimestamp, url: taskUrl } = this._getTaskTimestampAndUrl(data);

    data.self?.assignees?.forEach((assignee) => {
      const task = data.self ? this._createTaskReward(data.self, taskTimestamp, taskUrl) : undefined;
      console.log("++++ task", task);
      this._addUserToResult(result, assignee.login, assignee.id, task);
      console.log(result);
    });

    const allComments = await data.getAllComments();
    for (const comment of allComments) {
      if (comment.user && comment.body && this._checkEntryValidity(comment)) {
        this._addUserToResult(result, comment.user.login, comment.user.id);
      }
    }

    for (const review of data.linkedReviews) {
      review.reviews?.forEach((o) => {
        if (o.user && o.user.type === "User") {
          this._addUserToResult(result, o.user.login, o.user.id);
        }
      });
      review.self?.requested_reviewers?.forEach((reviewer) => {
        if (reviewer.type === "User" && reviewer.login) {
          this._addUserToResult(result, reviewer.login, reviewer.id);
        }
      });
    }

    return result;
  }
}
