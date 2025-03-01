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
    this.context.config.incentives.simplificationIncentivizer;
  private readonly _simplificationRate: number;

  constructor(context: ContextPlugin) {
    super(context);
    this._simplificationRate = this._configuration?.simplificationRate ?? 100;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const linkedPullRequests = data.linkedReviews.map((review) => review.self);
    if (!linkedPullRequests.length) {
      this.context.logger.warn(`No pull request is linked to this issue, won't run SimplificationIncentivizer`);
      return result;
    }
    const prNumbers = linkedPullRequests.map((pull) => pull?.number);
    this.context.logger.info("Pull requests linked to this issue", { prNumbers });

    for (const pull of linkedPullRequests) {
      if (!pull) continue;
      const prAuthor = pull.user.login;
      const simplificationReward = Math.max((pull.deletions - pull.additions) / this._simplificationRate, 0);
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
