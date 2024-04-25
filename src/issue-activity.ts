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
  /**
   * Review related item
   */
  REVIEW = 0b1,
  /**
   * Issue related item
   */
  ISSUE = 0b10,
  /**
   * User assigned to the {@link CommentType.ISSUE} or {@link CommentType.REVIEW}
   */
  ASSIGNEE = 0b100,
  /**
   * The author of the {@link CommentType.ISSUE} or {@link CommentType.REVIEW}
   */
  ISSUER = 0b1000,
  /**
   * A user that is part of the organization or owner of the repo
   */
  COLLABORATOR = 0b10000,
  /**
   * A user that is NOT part of the organization nor owner of the repo
   */
  CONTRIBUTOR = 0b100000,
  /**
   * A user comment action on a {@link CommentType.ISSUE} or {@link CommentType.REVIEW}
   */
  COMMENTED = 0b1000000,
  /**
   * Pull request opening item
   */
  TASK = 0b10000000,
  /**
   * Issue opening item
   */
  SPECIFICATION = 0b100000000,
}

export class IssueActivity {
  constructor(private _issueParams: IssueParams) {}

  self: GitHubIssue | null = null;
  events: GitHubIssueEvent[] = [];
  comments: GitHubIssueComment[] = [];
  linkedReviews: Review[] = [];

  async init() {
    [this.self, this.events, this.comments, this.linkedReviews] = await Promise.all([
      getIssue(this._issueParams),
      getIssueEvents(this._issueParams),
      getIssueComments(this._issueParams),
      this._getLinkedReviews(),
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
    ret |= "pull_request_review_id" in comment || "draft" in comment ? CommentType.REVIEW : CommentType.ISSUE;
    if (comment.id === self?.id) {
      ret |= ret & CommentType.ISSUE ? CommentType.TASK : CommentType.SPECIFICATION;
    } else {
      ret |= CommentType.COMMENTED;
    }
    if (comment.user?.id === self?.user?.id) {
      ret |= CommentType.ISSUER;
    } else if (comment.user?.id === self?.assignee?.id) {
      ret |= CommentType.ASSIGNEE;
    } else if (comment.author_association === "MEMBER" || comment.author_association === "COLLABORATOR") {
      ret |= CommentType.COLLABORATOR;
    } else {
      ret |= CommentType.CONTRIBUTOR;
    }
    return ret;
  }

  get allComments() {
    const comments: Array<
      (GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest) & { type: CommentType }
    > = this.comments.map((comment) => ({
      ...comment,
      type: this._getTypeFromComment(comment, this.self),
    }));
    if (this.self) {
      comments.push({
        ...this.self,
        type: this._getTypeFromComment(this.self, this.self),
      });
    }
    if (this.linkedReviews) {
      for (const linkedReview of this.linkedReviews) {
        if (linkedReview.self) {
          comments.push({
            ...linkedReview.self,
            type: this._getTypeFromComment(linkedReview.self, linkedReview.self),
          });
        }
        if (linkedReview.reviewComments) {
          for (const reviewComment of linkedReview.reviewComments) {
            comments.push({
              ...reviewComment,
              type: this._getTypeFromComment(reviewComment, linkedReview.self),
            });
          }
        }
      }
    }
    return comments;
  }
}

export class Review {
  self: GitHubPullRequest | null = null;
  reviews: GitHubPullRequestReviewState[] | null = null; // this includes every comment on the files view.
  reviewComments: GitHubPullRequestReviewComment[] | null = null;

  constructor(private _pullParams: PullParams) {}

  async init() {
    [this.self, this.reviews, this.reviewComments] = await Promise.all([
      getPullRequest(this._pullParams),
      getPullRequestReviews(this._pullParams),
      getPullRequestReviewComments(this._pullParams),
    ]);
  }
}
