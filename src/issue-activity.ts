import { CommentType } from "./configuration/comment-types";
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
  getIssue,
  getIssueComments,
  getIssueEvents,
  getPullRequest,
  getPullRequestReviewComments,
  getPullRequestReviews,
  IssueParams,
  PullParams,
} from "./start";
import { retryAsyncUntilDefinedDecorator } from "ts-retry";
import githubCommentModuleInstance from "./helpers/github-comment-module-instance";
import logger from "./helpers/logger";

export class IssueActivity {
  constructor(private _issueParams: IssueParams) {}

  self: GitHubIssue | null = null;
  events: GitHubIssueEvent[] = [];
  comments: GitHubIssueComment[] = [];
  linkedReviews: Review[] = [];

  async init() {
    function fn<T>(func: () => Promise<T>) {
      return func();
    }
    const decoratedFn = retryAsyncUntilDefinedDecorator(fn, {
      delay: 10000,
      maxTry: 10,
      async onError(error) {
        try {
          const content = "Failed to retrieve activity. Retrying...";
          const message = logger.error(content, { error });
          await githubCommentModuleInstance.postComment(message?.logMessage.diff || content);
        } catch (e) {
          logger.error(`${e}`);
        }
      },
      async onMaxRetryFunc(error) {
        try {
          const content = "Failed to retrieve activity after 10 attempts. See logs for more details.";
          const message = logger.error(content, {
            error,
          });
          await githubCommentModuleInstance.postComment(message?.logMessage.diff || content);
        } catch (e) {
          logger.error(`${e}`);
        }
      },
    });
    [this.self, this.events, this.comments, this.linkedReviews] = await Promise.all([
      decoratedFn(() => getIssue(this._issueParams)),
      decoratedFn(() => getIssueEvents(this._issueParams)),
      decoratedFn(() => getIssueComments(this._issueParams)),
      decoratedFn(() => this._getLinkedReviews()),
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
    issueType: CommentType.ISSUE | CommentType.REVIEW,
    comment:
      | GitHubIssueComment
      | GitHubPullRequestReviewComment
      | GitHubPullRequestReviewState
      | GitHubIssue
      | GitHubPullRequest,
    self: GitHubPullRequest | GitHubIssue | null
  ) {
    let ret = 0;
    ret |= issueType;
    if (comment.id === self?.id) {
      ret |= ret & CommentType.ISSUE ? CommentType.SPECIFICATION : CommentType.TASK;
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

  _getLinkedReviewComments() {
    const comments = [];
    for (const linkedReview of this.linkedReviews) {
      for (const value of Object.values(linkedReview)) {
        if (Array.isArray(value)) {
          for (const review of value) {
            comments.push({
              ...review,
              type: this._getTypeFromComment(CommentType.REVIEW, review, linkedReview.self),
            });
          }
        } else if (value) {
          comments.push({
            ...value,
            type: this._getTypeFromComment(CommentType.REVIEW, value, value),
          });
        }
      }
    }
    return comments;
  }

  get allComments() {
    const comments: Array<
      (GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest) & { type: CommentType }
    > = this.comments.map((comment) => ({
      ...comment,
      type: this._getTypeFromComment(CommentType.ISSUE, comment, this.self),
    }));
    if (this.self) {
      comments.push({
        ...this.self,
        type: this._getTypeFromComment(CommentType.ISSUE, this.self, this.self),
      });
    }
    if (this.linkedReviews) {
      comments.push(...this._getLinkedReviewComments());
    }
    return comments;
  }
}

export class Review {
  self: GitHubPullRequest | null = null;
  reviews: GitHubPullRequestReviewState[] | null = null; // this includes every comment on the files view.
  reviewComments: GitHubPullRequestReviewComment[] | null = null;
  comments: GitHubIssueComment[] | null = null;

  constructor(private _pullParams: PullParams) {}

  async init() {
    [this.self, this.reviews, this.reviewComments, this.comments] = await Promise.all([
      getPullRequest(this._pullParams),
      getPullRequestReviews(this._pullParams),
      getPullRequestReviewComments(this._pullParams),
      // This fetches all the comments inside the Pull Request that were not created in a reviewing context
      getIssueComments({
        owner: this._pullParams.owner,
        repo: this._pullParams.repo,
        issue_number: this._pullParams.pull_number,
      }),
    ]);
  }
}
