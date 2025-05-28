import { RestEndpointMethodTypes } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { minimatch } from "minimatch";
import {
  SimplificationIncentivizerConfiguration,
  simplificationIncentivizerConfigurationType,
} from "../configuration/simplification-incentivizer-config";
import { GitHubPullRequest } from "../github-types";
import { getExcludedFiles } from "../helpers/excluded-files";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result } from "../types/results";

type GitHubPullRequestFile = RestEndpointMethodTypes["pulls"]["listFiles"]["response"]["data"][0];

export class SimplificationIncentivizerModule extends BaseModule {
  private readonly _configuration: SimplificationIncentivizerConfiguration | null =
    this.context.config.incentives.simplificationIncentivizer;
  private readonly _simplificationRate: number;

  constructor(context: ContextPlugin) {
    super(context);
    this._simplificationRate = Number(this._configuration?.simplificationRate);
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const linkedPullRequests = data.linkedReviews.map((review) => review.self);
    if (!linkedPullRequests.length) {
      this.context.logger.warn("No pull request is linked to this issue, won't run SimplificationIncentivizer");
      return result;
    }
    const prNumbers = linkedPullRequests.map((pull) => pull?.number);

    this.context.logger.info("Pull requests linked to this issue", { prNumbers });
    for (const pull of linkedPullRequests) {
      if (!pull?.head.repo) continue;
      result = await this._processPullRequest(pull as GitHubPullRequest, result);
    }
    return result;
  }

  private async _processPullRequest(pull: GitHubPullRequest, result: Result) {
    const excludedFilePatterns = await getExcludedFiles(this.context, pull.base.repo.owner.login, pull.base.repo.name);
    const prAuthor = pull.user.login;
    try {
      const files = await this.context.octokit.rest.pulls.listFiles({
        owner: pull.base.repo.owner.login,
        repo: pull.base.repo.name,
        pull_number: pull.number,
      });
      for (const file of files.data) {
        this._processFile(file, excludedFilePatterns, prAuthor, pull, result);
      }
    } catch (e) {
      if (e && typeof e === "object" && "status" in e && e.status === 404) {
        this.context.logger.warn("No file was found in the pull-request, skipping", {
          url: pull.html_url,
          owner: pull.base.repo.owner.login,
          repo: pull.base.repo.name,
          pull_number: pull.number,
          err: e,
        });
        return result;
      }
      throw e;
    }
    return result;
  }

  private _processFile(
    file: GitHubPullRequestFile,
    excludedFilePatterns: string[] | undefined,
    prAuthor: string,
    pull: GitHubPullRequest,
    result: Result
  ) {
    if (!excludedFilePatterns?.length || !excludedFilePatterns.some((pattern) => minimatch(file.filename, pattern))) {
      result[prAuthor].simplificationReward = result[prAuthor].simplificationReward ?? {
        files: [],
        url: pull.html_url,
      };
      const reward = Math.max((file.deletions - file.additions) / this._simplificationRate, 0);
      if (reward !== 0) {
        result[prAuthor].simplificationReward.files.push({
          additions: file.additions,
          deletions: file.deletions,
          reward: reward,
          fileName: file.filename,
        });
      }
    }
  }

  get enabled(): boolean {
    if (!Value.Check(simplificationIncentivizerConfigurationType, this._configuration)) {
      this.context.logger.warn(
        "Invalid / missing configuration detected for SimplificationIncentivizerModule, disabling."
      );
      return false;
    }
    return true;
  }
}
