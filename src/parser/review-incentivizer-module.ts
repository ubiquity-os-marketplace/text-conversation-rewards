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
      currentElement.reviewReward = {};

      const reviewsByUser = linkedPullReviews.filter((v) => v.user?.login === key);

      currentElement.reviewReward.reviewBaseReward = reviewsByUser.some((v) => v.state === "APPROVED")
        ? { reward: this._conclusiveReviewCredit }
        : { reward: 0 };

      const reviewDiffs = await this.fetchReviewDiffRewards(owner, repo, reviewsByUser);

      currentElement.reviewReward.reviews = reviewDiffs;
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

  async fetchReviewDiffRewards(owner: string, repo: string, reviewsByUser: GitHubPullRequestReviewState[]) {
    const reviews: ReviewScore[] = [];

    for (let i = 0; i < reviewsByUser.length; i++) {
      const currentReview = reviewsByUser[i];
      const nextReview = reviewsByUser[i + 1];

      if (currentReview.commit_id && nextReview?.commit_id && currentReview.state !== "APPROVED") {
        const baseSha = currentReview.commit_id;
        const headSha = nextReview.commit_id;

        if (headSha) {
          try {
            const diff = await this.getTripleDotDiffAsObject(owner, repo, baseSha, headSha);
            const reviewEffect = { addition: 0, deletion: 0 };
            Object.keys(diff).forEach((fileName) => {
              if (fileName !== "yarn.lock") {
                const changes = diff[fileName];
                reviewEffect.addition += changes.addition;
                reviewEffect.deletion += changes.deletion;
              }
            });
            reviews.push({
              reviewId: currentReview.id,
              effect: reviewEffect,
              reward: reviewEffect.addition + reviewEffect.deletion,
            });
          } catch (e) {
            this.context.logger.error(`Failed to get diff between commits ${baseSha} and ${headSha}:`, { e });
          }
        }
      }
    }

    return reviews;
  }

  async calculateReviewsDiffReward(reviews: ReviewScore[]) {
    let reviewReward = 0;
    for (const review of reviews) {
      reviewReward += review.effect.addition + review.effect.deletion;
    }
    return reviewReward / this._baseRate;
  }

  get enabled(): boolean {
    if (!Value.Check(reviewIncentivizerConfigurationType, this._configuration)) {
      this.context.logger.error("Invalid / missing configuration detected for ReviewIncentivizerModule, disabling.");
      return false;
    }
    return true;
  }
}
