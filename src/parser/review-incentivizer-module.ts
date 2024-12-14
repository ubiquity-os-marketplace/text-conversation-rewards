import { Value } from "@sinclair/typebox/value";
import {
  ReviewIncentivizerConfiguration,
  reviewIncentivizerConfigurationType,
} from "../configuration/review-incentivizer-config";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { Result } from "../types/results";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedMergedPulls } from "../data-collection/collect-linked-pulls";
import { getPullRequestReviews } from "../start";
import { GitHubPullRequestReviewState } from "../github-types";

interface CommitDiff {
  [fileName: string]: {
    addition: number;
    deletion: number;
  };
}

export class ReviewIncentivizerModule extends BaseModule {
  private readonly _configuration: ReviewIncentivizerConfiguration | null =
    this.context.config.incentives.reviewIncentivizer;
  private readonly _baseRate: number;
  private readonly _conclusiveReviewCredit: number;

  constructor(context: ContextPlugin) {
    super(context);
    this._baseRate = this._configuration?.baseRate ?? 100;
    this._conclusiveReviewCredit = this._configuration?.conclusiveReviewCredit ?? 25;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    if (!data.self) {
      return result;
    }

    const owner = this.context.payload.repository.owner.login;
    const repo = this.context.payload.repository.name;

    const linkedPullNumber = (
      await collectLinkedMergedPulls(this.context, {
        owner: owner,
        repo: repo,
        issue_number: data.self?.number,
      })
    ).slice(-1)[0].number;
    const linkedPullReviews = await getPullRequestReviews(this.context, {
      owner: owner,
      repo: repo,
      pull_number: linkedPullNumber,
    });

    for (const key of Object.keys(result)) {
      const currentElement = result[key];
      const reviewReward: {
        reviewDiffReward?: number;
        reviewBaseReward?: number;
      } = currentElement.reviewReward || {};

      const reviewsByUser = linkedPullReviews.filter((v) => v.user?.login === key && v.state !== "APPROVED").reverse();

      reviewReward.reviewBaseReward = linkedPullReviews.some((v) => v.state === "APPROVED") ? this._baseRate : 0;
      reviewReward.reviewDiffReward = await this.calculateReviewsDiffReward(
        owner,
        repo,
        linkedPullNumber,
        reviewsByUser
      );
    }

    return result;
  }

  private async _getPreviousCommit(
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha: string
  ): Promise<string | null> {
    try {
      const response = await this.context.octokit.rest.pulls.listCommits({
        owner,
        repo,
        pull_number: pullNumber,
      });

      const commits = response.data;
      const currentCommitIndex = commits.findIndex((commit) => commit.sha === commitSha);

      if (currentCommitIndex > 0) {
        return commits[currentCommitIndex - 1].sha;
      }

      return null;
    } catch (e) {
      this.context.logger.error(`Failed to get previous commit for ${commitSha}:`, { e });
      return null;
    }
  }

  async getTripleDotDiffAsObject(owner: string, repo: string, baseSha: string, headSha: string): Promise<CommitDiff> {
    const response = await this.context.octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: baseSha,
      head: headSha,
    });

    const files = response.data.files || [];
    const diff: CommitDiff = {};

    for (const file of files) {
      diff[file.filename] = {
        addition: file.additions || 0,
        deletion: file.deletions || 0,
      };
    }

    return diff;
  }

  async calculateReviewsDiffReward(
    owner: string,
    repo: string,
    linkedPullNumber: number,
    reviewsByUser: GitHubPullRequestReviewState[]
  ) {
    const reviewDiffs: CommitDiff[] = [];
    let reviewDiffReward = 0;

    for (let i = 0; i < reviewsByUser.length; i++) {
      const currentReview = reviewsByUser[i];
      const nextReview = reviewsByUser[i + 1];

      if (currentReview.commit_id && nextReview?.commit_id) {
        const baseSha = currentReview.commit_id;
        const headSha = await this._getPreviousCommit(owner, repo, linkedPullNumber, nextReview.commit_id);

        if (headSha) {
          try {
            const diff = await this.getTripleDotDiffAsObject(owner, repo, baseSha, headSha);
            reviewDiffs.push(diff);
          } catch (e) {
            this.context.logger.error(`Failed to get diff between commits ${baseSha} and ${headSha}:`, { e });
          }
        }
      }
    }

    for (const reviewDiff of reviewDiffs) {
      Object.keys(reviewDiff).forEach((fileName) => {
        // ignoring generated files

        const changes = reviewDiff[fileName];
        reviewDiffReward += changes.addition + changes.deletion;
      });
    }
    return reviewDiffReward;
  }

  get enabled(): boolean {
    if (!Value.Check(reviewIncentivizerConfigurationType, this._configuration)) {
      this.context.logger.error("Invalid / missing configuration detected for ReviweIncentivizerModule, disabling.");
      return false;
    }
    return true;
  }
}
