import { Value } from "@sinclair/typebox/value";
import {
  ReviewIncentivizerConfiguration,
  reviewIncentivizerConfigurationType,
} from "../configuration/review-incentivizer-config";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { Result, ReviewScore } from "../types/results";
import { ContextPlugin } from "../types/plugin-input";
import { collectLinkedMergedPulls } from "../data-collection/collect-linked-pulls";
import { GitHubPullRequestReviewState } from "../github-types";
import { parsePriorityLabel } from "../helpers/github";
import { getExcludedFiles } from "../helpers/excluded-files";
import { minimatch } from "minimatch";

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
    if (!data.self?.assignees) {
      return result;
    }

    const owner = this.context.payload.repository.owner.login;
    const repo = this.context.payload.repository.name;
    const assignees = data.self?.assignees?.map((assignee) => assignee.login);

    const linkedPulls = (
      await collectLinkedMergedPulls(this.context, {
        owner: owner,
        repo: repo,
        issue_number: data.self?.number,
      })
    ).filter((pull) => assignees?.includes(pull.author.login));

    if (linkedPulls.length > 1) {
      this.context.logger.info(`Pull requests ${linkedPulls.map((pull) => pull.number)} are linked to this issue`);
    } else if (linkedPulls.length == 1) {
      this.context.logger.info(`Pull request ${linkedPulls[0].number} is linked to this issue`);
    } else {
      throw this.context.logger.error(`No pull request linked to this issue, Aborting`);
    }

    for (const username of Object.keys(result)) {
      const reward = result[username];
      reward.reviewRewards = [];

      for (const linkedPull of linkedPulls) {
        const linkedPullReviews = data.linkedReviews.filter((review) => review.self?.html_url === linkedPull.url)[0];
        if (linkedPullReviews.reviews) {
          const reviewsByUser = linkedPullReviews.reviews.filter((v) => v.user?.login === username);

          const reviewBaseReward = reviewsByUser.some((v) => v.state === "APPROVED" || v.state === "CHANGES_REQUESTED")
            ? { reward: this._conclusiveReviewCredit }
            : { reward: 0 };

          const reviewDiffs = await this.fetchReviewDiffRewards(owner, repo, reviewsByUser);
          reward.reviewRewards.push({ reviews: reviewDiffs, url: linkedPull.url, reviewBaseReward });
        }
      }
    }

    return result;
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
  async getReviewableDiff(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
    excludedFilePatterns?: string[] | null
  ) {
    const diff = await this.getTripleDotDiffAsObject(owner, repo, baseSha, headSha);
    const reviewEffect = { addition: 0, deletion: 0 };
    for (const [fileName, changes] of Object.entries(diff)) {
      if (!excludedFilePatterns?.length || !excludedFilePatterns.some((pattern) => minimatch(fileName, pattern))) {
        reviewEffect.addition += changes.addition;
        reviewEffect.deletion += changes.deletion;
      }
    }
    return reviewEffect;
  }

  async fetchReviewDiffRewards(owner: string, repo: string, reviewsByUser: GitHubPullRequestReviewState[]) {
    if (reviewsByUser.length == 0) {
      return;
    }
    const reviews: ReviewScore[] = [];
    const priority = parsePriorityLabel(this.context.payload.issue.labels);
    const pullNumber = Number(reviewsByUser[0].pull_request_url.split("/").slice(-1)[0]);

    const pullCommits = (
      await this.context.octokit.rest.pulls.listCommits({
        owner: owner,
        repo: repo,
        pull_number: pullNumber,
      })
    ).data;

    // Get the first commit of the PR
    const firstCommitSha = pullCommits[0]?.parents[0]?.sha;
    if (!firstCommitSha) {
      throw this.context.logger.error("Could not fetch base commit for this pull request");
    }
    const excludedFilePatterns = await getExcludedFiles(this.context);
    for (let i = 0; i < reviewsByUser.length; i++) {
      const currentReview = reviewsByUser[i];
      const previousReview = reviewsByUser[i - 1];

      if (currentReview.commit_id) {
        const baseSha = previousReview?.commit_id ? previousReview.commit_id : firstCommitSha;
        const headSha = currentReview.commit_id;

        if (headSha) {
          try {
            const reviewEffect = await this.getReviewableDiff(owner, repo, baseSha, headSha, excludedFilePatterns);
            reviews.push({
              reviewId: currentReview.id,
              effect: reviewEffect,
              reward: ((reviewEffect.addition + reviewEffect.deletion) * priority) / this._baseRate,
              priority: priority,
            });
          } catch (e) {
            this.context.logger.error(`Failed to get diff between commits ${baseSha} and ${headSha}:`, { e });
          }
        }
      }
    }

    return reviews;
  }

  get enabled(): boolean {
    if (!Value.Check(reviewIncentivizerConfigurationType, this._configuration)) {
      this.context.logger.error("Invalid / missing configuration detected for ReviewIncentivizerModule, disabling.");
      return false;
    }
    return true;
  }
}
