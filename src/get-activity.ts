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

export enum CommentType {
  REVIEW = 0b1,
  ISSUE = 0b10,
  ASSIGNEE = 0b100,
  ISSUER = 0b1000,
  COLLABORATOR = 0b10000,
  CONTRIBUTOR = 0b100000,
}

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
    [this.self, this.events, this.comments, this.linkedReviews] = await Promise.all([
      this.self,
      this.events,
      this.comments,
      this.linkedReviews,
    ]);
  }

  private async _getLinkedReviews(): Promise<Review[]> {
    const pulls = await collectLinkedMergedPulls(this._issueParams);
    const promises = pulls
      .map(async (pull) => {
        const repository = pull.source.issue.repository;

        if (!repository) {
          console.error(`No repository found for [${pull.source.issue.repository}]`);
          return null;
        } else {
          const pullParams = {
            owner: repository.owner.login,
            repo: repository.name,
            pull_number: pull.source.issue.number,
          };
          const review = new Review(pullParams);
          await review.init();
          return review;
        }
      })
      .filter((o) => o !== null) as Promise<Review>[];
    return Promise.all(promises);
  }

  _getTypeFromComment(
    comment: GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest,
    self: GitHubPullRequest | GitHubIssue | null
  ) {
    let ret = 0;
    ret |= "pull_request_review_id" in comment ? CommentType.REVIEW : CommentType.ISSUE;
    if (comment.user?.id === self?.user?.id) {
      ret |= CommentType.ISSUER;
    } else if (comment.user?.id === self?.assignee?.id) {
      ret |= CommentType.ASSIGNEE;
    } else if (comment.author_association === "MEMBER") {
      ret |= CommentType.COLLABORATOR;
    } else if (comment.author_association === "CONTRIBUTOR") {
      ret |= CommentType.CONTRIBUTOR;
    }
    return ret;
  }

  get allComments() {
    const comments: Array<
      (GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest) & { type: CommentType }
    > = (this.comments as GitHubIssueComment[]).map((comment) => ({
      ...comment,
      type: this._getTypeFromComment(comment, this.self as GitHubIssue),
    }));
    if (this.self) {
      comments.push({
        ...(this.self as GitHubIssue),
        type: this._getTypeFromComment(this.self as GitHubIssue, this.self as GitHubIssue),
      });
    }
    if (this.linkedReviews) {
      for (const linkedReview of this.linkedReviews as Review[]) {
        if (linkedReview.self) {
          comments.push({
            ...(linkedReview.self as GitHubPullRequest),
            type: this._getTypeFromComment(
              linkedReview.self as GitHubPullRequest,
              linkedReview.self as GitHubPullRequest
            ),
          });
        }
        if (linkedReview.reviewComments) {
          for (const reviewComment of linkedReview.reviewComments as GitHubPullRequestReviewComment[]) {
            comments.push({
              ...reviewComment,
              type: this._getTypeFromComment(reviewComment, linkedReview.self as GitHubPullRequest),
            });
          }
        }
      }
    }
    return comments;
  }
}

export class Review {
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
