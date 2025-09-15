import { Value } from "@sinclair/typebox/value";
import {
  ReviewIncentivizerConfiguration,
  reviewIncentivizerConfigurationType,
} from "../configuration/review-incentivizer-config";
import { GitHubPullRequestReviewState } from "../github-types";
import { getExcludedFiles, shouldExcludeFile } from "../helpers/excluded-files";
import { parsePriorityLabel } from "../helpers/github";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result, ReviewScore } from "../types/results";
import { PullRequestData } from "../helpers/pull-request-data";

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

  constructor(context: ContextPlugin) {
    super(context);
    this._baseRate = this._configuration?.baseRate ?? 100;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    if (!data.self?.assignees) {
      return result;
    }

    const prNumbers = data.linkedReviews.map((review) => review.self?.number);
    if (!prNumbers.length) {
      this.context.logger.warn(`No pull request is linked to this issue, won't run review incentivizer`);
      return result;
    }

    this.context.logger.info(`Pull requests linked to this issue`, { prNumbers });

    for (const username of Object.keys(result)) {
      const reward = result[username];
      reward.reviewRewards = [];

      for (const linkedPullReviews of data.linkedReviews) {
        if (linkedPullReviews.reviews && linkedPullReviews.self && username !== linkedPullReviews.self.user.login) {
          const reviewsByUser = linkedPullReviews.reviews.filter((v) => v.user?.login === username);
          const headOwnerRepo = linkedPullReviews.self.head.repo?.full_name;
          const baseOwner = linkedPullReviews.self.base.repo.owner.login;
          const baseRepo = linkedPullReviews.self.base.repo.name;
          const baseRef = linkedPullReviews.self.base.ref;
          const reviewDiffs = await this.fetchReviewDiffRewards(
            baseOwner,
            baseRepo,
            baseRef,
            headOwnerRepo ?? "",
            reviewsByUser
          );
          reward.reviewRewards.push({ reviews: reviewDiffs, url: linkedPullReviews.self.html_url });
        }
      }
    }
    return result;
  }

  async getTripleDotDiffAsObject(
    owner: string,
    repo: string,
    baseSha: string,
    headSha: string,
    prData: PullRequestData
  ): Promise<CommitDiff> {
    const fileList = prData.fileList;

    const response = await this.context.octokit.rest.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${baseSha}...${headSha}`,
    });

    const files = response.data.files || [];
    const allowedFiles = fileList;
    const diff: CommitDiff = {};

    for (const file of files) {
      if (file.status === "removed" || !allowedFiles.some((o) => o.filename === file.filename)) continue;
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
    prData: PullRequestData,
    excludedFilePatterns?: string[] | null
  ) {
    const diff = await this.getTripleDotDiffAsObject(owner, repo, baseSha, headSha, prData);
    const reviewEffect = { addition: 0, deletion: 0 };
    for (const [fileName, changes] of Object.entries(diff)) {
      if (!shouldExcludeFile(fileName, excludedFilePatterns)) {
        reviewEffect.addition += changes.addition;
        reviewEffect.deletion += changes.deletion;
      }
    }
    return reviewEffect;
  }

  async fetchReviewDiffRewards(
    baseOwner: string,
    baseRepo: string,
    baseRef: string,
    headOwnerRepo: string,
    reviewsByUser: GitHubPullRequestReviewState[]
  ) {
    if (reviewsByUser.length == 0) {
      return;
    }
    const reviews: ReviewScore[] = [];
    const priority = parsePriorityLabel(this.context.payload.issue.labels);
    const pullNumber = Number(reviewsByUser[0].pull_request_url.split("/").slice(-1)[0]);

    const prData = new PullRequestData(this.context, baseOwner, baseRepo, pullNumber);
    await prData.fetchData();

    // Get the first commit of the PR
    const firstCommitSha = prData.pullCommits[0]?.parents[0]?.sha || prData.pullCommits[0]?.sha;
    if (!firstCommitSha) {
      throw this.context.logger.error("Could not fetch base commit for this pull request");
    }
    const excludedFilePatterns = await getExcludedFiles(this.context, baseOwner, baseRepo, baseRef);
    for (const [i, currentReview] of reviewsByUser.entries()) {
      if (!currentReview.commit_id) continue;

      const previousReview = reviewsByUser[i - 1];
      const baseSha = previousReview?.commit_id ? previousReview.commit_id : firstCommitSha;
      const headSha = `${headOwnerRepo.replace("/", ":")}:${currentReview.commit_id}`;

      if (headSha && baseSha !== currentReview.commit_id) {
        try {
          const reviewEffect = await this.getReviewableDiff(
            baseOwner,
            baseRepo,
            baseSha,
            headSha,
            prData,
            excludedFilePatterns
          );
          this.context.logger.debug("Fetched diff between commits", {
            baseOwner,
            baseRepo,
            baseSha,
            headSha,
            reviewEffect,
          });
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

    return reviews;
  }

  get enabled(): boolean {
    if (!Value.Check(reviewIncentivizerConfigurationType, this._configuration)) {
      this.context.logger.warn(
        "The configuration for the module ReviewIncentivizerModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }
}
