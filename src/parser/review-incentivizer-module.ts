import { Value } from "@sinclair/typebox/value";
import {
  ReviewIncentivizerConfiguration,
  reviewIncentivizerConfigurationType,
} from "../configuration/review-incentivizer-config";
import { GitHubPullRequestReviewState } from "../github-types";
import { getExcludedFiles, shouldExcludeFile } from "../helpers/excluded-files";
import { PullRequestData } from "../helpers/pull-request-data";
import { IssueActivity } from "../issue-activity";
import { BaseModule } from "../types/module";
import { ContextPlugin } from "../types/plugin-input";
import { Result, ReviewScore } from "../types/results";
import { isUserAllowedToGenerateRewards } from "../helpers/permissions";

/**
 * Review states that are considered "conclusive" and should receive credit.
 * COMMENTED reviews (left comments without approval/changes) do NOT receive credit.
 * Only APPROVED or CHANGES_REQUESTED reviews are conclusive.
 */
const CONCLUSIVE_REVIEW_STATES = ["APPROVED", "CHANGES_REQUESTED"];

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
    if (!data.self?.assignees || !this.isPullRequest()) {
      this.context.logger.warn("No assignees or pull request found, won't run review incentivizer module");
      return result;
    }

    const priority = await this.computePriority(data);
    for (const username of Object.keys(result)) {
      const reward = result[username];
      reward.reviewRewards = [];

      for (const linkedPullReviews of data.linkedMergedPullRequests) {
        if (linkedPullReviews.reviews && linkedPullReviews.self && username !== linkedPullReviews.self.user.login) {
          if (!(await isUserAllowedToGenerateRewards(this.context, username))) {
            this.context.logger.warn("The user is not allowed to receive rewards for a review", { username });
            continue;
          }
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
            reviewsByUser,
            priority
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
    reviewsByUser: GitHubPullRequestReviewState[],
    priority: number
  ) {
    if (reviewsByUser.length == 0) {
      this.context.logger.debug("No reviews found for this pull request", { baseOwner, baseRepo, baseRef });
      return;
    }
    const reviews: ReviewScore[] = [];
    const pullNumber = Number(reviewsByUser[0].pull_request_url.split("/").slice(-1)[0]);

    const prData = new PullRequestData(this.context, baseOwner, baseRepo, pullNumber);
    await prData.fetchData();

    // Get the first commit of the PR
    const firstCommitSha = prData.pullCommits[0]?.parents?.[0]?.sha || prData.pullCommits[0]?.sha;
    if (!firstCommitSha) {
      throw this.context.logger.error("Could not fetch base commit for this pull request");
    }
    const excludedFilePatterns = await getExcludedFiles(this.context, baseOwner, baseRepo, baseRef);
    let shouldSkipSubsequentDiff = false;

    for (const [i, currentReview] of reviewsByUser.entries()) {
      if (!currentReview.commit_id) continue;
      if (!this.isReviewConclusive(currentReview)) {
        this.context.logger.debug("Skipping non-conclusive review (no credit)", {
          reviewId: currentReview.id,
          state: currentReview.state,
          username: reviewsByUser[0]?.user?.login,
        });
        continue;
      }
      if (shouldSkipSubsequentDiff) {
        this.context.logger.debug("Skipping diff calculation after APPROVED review", {
          reviewId: currentReview.id,
          previousReviewId: reviewsByUser[i - 1]?.id,
        });
        shouldSkipSubsequentDiff = false;
        continue;
      }
      const diffResult = await this.computeReviewDiff(
        currentReview,
        reviewsByUser[i - 1],
        firstCommitSha,
        headOwnerRepo,
        baseOwner,
        baseRepo,
        prData,
        excludedFilePatterns,
        priority
      );
      if (diffResult) {
        reviews.push(diffResult);
        if (currentReview.state === "APPROVED") {
          shouldSkipSubsequentDiff = true;
        }
      }
    }

    return reviews;
  }

  private isReviewConclusive(review: GitHubPullRequestReviewState): boolean {
    return CONCLUSIVE_REVIEW_STATES.includes(review.state || "");
  }

  private async computeReviewDiff(
    currentReview: GitHubPullRequestReviewState,
    previousReview: GitHubPullRequestReviewState | undefined,
    firstCommitSha: string,
    headOwnerRepo: string,
    baseOwner: string,
    baseRepo: string,
    prData: PullRequestData,
    excludedFilePatterns: string[] | null,
    priority: number
  ): Promise<ReviewScore | null> {
    const previousCommitId = previousReview?.commit_id;
    const baseSha = previousCommitId ?? firstCommitSha;
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
        return {
          reviewId: currentReview.id,
          effect: reviewEffect,
          reward: ((reviewEffect.addition + reviewEffect.deletion) * priority) / this._baseRate,
          priority: priority,
        };
      } catch (e) {
        this.context.logger.error(`Failed to get diff between commits ${baseSha} and ${headSha}:`, { e });
      }
    }
    return null;
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
