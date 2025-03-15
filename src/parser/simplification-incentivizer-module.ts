import { Value } from "@sinclair/typebox/value";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";
import {
  SimplificationIncentivizerConfiguration,
  simplificationIncentivizerConfigurationType,
} from "../configuration/simplification-incentivizer-config";
import { getExcludedFiles } from "../helpers/excluded-files";
import { minimatch } from "minimatch";

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
      if (!pull?.head.repo) continue;
      const excludedFilePatterns = await getExcludedFiles(
        this.context,
        pull.head.repo.owner.login,
        pull.head.repo.name
      );
      const prAuthor = pull.user.login;
      const files = await this.context.octokit.rest.pulls.listFiles({
        owner: pull.head.repo.owner.login,
        repo: pull.head.repo.name,
        pull_number: pull.number,
      });

      result[prAuthor].simplificationReward = {};

      for (const file of files.data) {
        if (
          !excludedFilePatterns?.length ||
          !excludedFilePatterns.some((pattern) => minimatch(file.filename, pattern))
        ) {
          const reward = Math.max((file.deletions - file.additions) / this._simplificationRate, 0);
          if (reward != 0) {
            result[prAuthor].simplificationReward[file.filename] = {
              additions: file.additions,
              deletions: file.deletions,
              reward: reward,
            };
          }
        }
      }
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
