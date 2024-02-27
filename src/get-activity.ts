import { collectLinkedMergedPulls } from "./data-collection/collect-linked-pulls";
import {
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueEvent,
  GitHubPullRequest,
  GitHubPullRequestReviewComment,
  GitHubPullRequestReviewState,
} from "./github-types";
import {
  IssueParams,
  PullParams,
  getIssue,
  getIssueComments,
  getIssueEvents,
  getPullRequest,
  getPullRequestReviewComments,
  getPullRequestReviews,
} from "./start";

export class GetActivity {
  constructor(private _issueParams: IssueParams) {}
  self: Promise<GitHubIssue> | GitHubIssue | null = null;
  events: Promise<GitHubIssueEvent[]> | GitHubIssueEvent[] | null = null;
  comments: Promise<GitHubIssueComment[]> | GitHubIssueComment[] | null = null;
  linkedReviews: Promise<Review[]> | Review[] | null = null;

  async init() {
    this.self = getIssue(this._issueParams);
    this.events = getIssueEvents(this._issueParams);
    this.comments = getIssueComments(this._issueParams);
    this.linkedReviews = this._getLinkedReviews();
    [this.self, this.events, this.comments, this.linkedReviews] = await Promise.all([this.self, this.events, this.comments, this.linkedReviews]);
  }

  private async _getLinkedReviews(): Promise<Review[]> {
    const pulls = await collectLinkedMergedPulls(this._issueParams);
    const promises = pulls.map((pull) => {
      const repository = pull.source.issue.repository;

      if (!repository) {
        throw new Error("No repository found");
      }

      const pullParams = {
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: pull.source.issue.number,
      };
      const review = new Review(pullParams);
      return review.init().then(() => review);
    });
    return Promise.all(promises);
  }
}

class Review {
  self: Promise<GitHubPullRequest> | GitHubPullRequest | null = null;
  reviews: Promise<GitHubPullRequestReviewState[]> | GitHubPullRequestReviewState[] | null = null; // this includes every comment on the files view.
  reviewComments: Promise<GitHubPullRequestReviewComment[]> | GitHubPullRequestReviewComment[] | null = null;

  constructor(private _pullParams: PullParams) {}

  async init() {
    this.self = getPullRequest(this._pullParams);
    this.reviews = getPullRequestReviews(this._pullParams);
    this.reviewComments = getPullRequestReviewComments(this._pullParams);

    // Wait for all promises to resolve
    [this.self, this.reviews, this.reviewComments] = await Promise.all([this.self, this.reviews, this.reviewComments]);
  }
}
