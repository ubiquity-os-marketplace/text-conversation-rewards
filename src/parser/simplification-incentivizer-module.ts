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
    let pullRequest;
    if ("issue" in this.context.payload) {
      if (this.context.payload.issue.pull_request) {
        const pull = await this.context.octokit.rest.pulls.get({
          owner: this.context.payload.repository.owner.login,
          repo: this.context.payload.repository.name,
          pull_number: this.context.payload.issue.number,
        });
        pullRequest = pull.data;
      }
    } else {
      pullRequest = this.context.payload.pull_request;
    }
    if (!pullRequest) {
      this.context.logger.warn("This is not a pull-request, won't run SimplificationIncentivizer module.");
      return result;
    }

    result = await this._processPullRequest(pullRequest as GitHubPullRequest, result);
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
