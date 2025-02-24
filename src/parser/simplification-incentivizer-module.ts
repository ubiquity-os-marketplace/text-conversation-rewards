import { Value } from "@sinclair/typebox/value";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import {
  SimplificationIncentivizerConfiguration,
  simplificationIncentivizerConfigurationType,
} from "../configuration/simplification-incentivizer-config";

export class SimplificationIncentivizerModule extends BaseModule {
  private readonly _configuration: SimplificationIncentivizerConfiguration | null =
    this.context.config.incentives.reviewIncentivizer;

  constructor(context: ContextPlugin) {
    super(context);
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const linkedPullRequests = data.linkedReviews.map((review) => review.self);
    if (!linkedPullRequests.length) {
      this.context.logger.warn(`No pull request is linked to this issue, won't run review incentivizer`);
      return result;
    }

    const message =
      linkedPullRequests.length === 1
        ? `Pull request ${linkedPullRequests[0]?.number} is linked to this issue`
        : `Pull requests ${linkedPullRequests.map((pull) => pull?.number)} are linked to this issue`;

    this.context.logger.info(message);

    for (const pull of linkedPullRequests) {
      if (!pull) continue;
      const prAuthor = pull.user.login;
      const simplificationReward = Math.max((pull.deletions - pull.additions) / 10, 0);
      result[prAuthor].simplificationReward = { reward: simplificationReward };
    }

    return result;
  }

  get enabled(): boolean {
    if (!Value.Check(simplificationIncentivizerConfigurationType, this._configuration)) {
      this.context.logger.error(
        "Invalid / missing configuration detected for SimplificationIncentivizerModule, disabling."
      );
      return false;
    }
    return true;
  }
}
