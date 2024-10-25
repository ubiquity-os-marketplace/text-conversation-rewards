import { CommentAssociation, CommentKind } from "./configuration/comment-types";
import { DataCollectionConfiguration } from "./configuration/data-collection-config";
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
import logger from "./helpers/logger";
import { ContextPlugin } from "./types/plugin-input";

export class IssueActivity {
  private readonly _context: ContextPlugin;
  readonly _configuration: DataCollectionConfiguration;

  constructor(
    context: ContextPlugin,
    private _issueParams: IssueParams
  ) {
    this._context = context;
    this._configuration = this._context.config.dataCollection;
  }

  self: GitHubIssue | null = null;
  events: GitHubIssueEvent[] = [];
  comments: GitHubIssueComment[] = [];
  linkedReviews: Review[] = [];

  async init() {
    try {
      [this.self, this.events, this.comments, this.linkedReviews] = await Promise.all([
        getIssue(this._context, this._issueParams),
        getIssueEvents(this._context, this._issueParams),
        getIssueComments(this._context, this._issueParams),
        this._getLinkedReviews(),
      ]);
    } catch (error) {
      throw logger.error(`Could not fetch issue data: ${error}`);
    }
  }

  private async _getLinkedReviews(): Promise<Review[]> {
    logger.debug("Trying to fetch linked pull-requests for", this._issueParams);
    const pulls = (await collectLinkedMergedPulls(this._context, this._issueParams)).slice(-1);
    logger.debug("Collected linked pull-requests", { pulls });
    const promises = pulls
      .map(async (pull) => {
        const repository = pull.repository;

        if (!repository) {
          logger.error(`No repository found for`, { ...pull.repository });
          return null;
        } else {
          const pullParams = {
            owner: repository.owner.login,
            repo: repository.name,
            pull_number: pull.number,
          };
          const review = new Review(this._context, pullParams);
          await review.init();
          return review;
        }
      })
      .filter((o) => o !== null) as Promise<Review>[];
    return Promise.all(promises);
  }

  _getTypeFromComment(
    issueType: CommentKind,
    comment:
      | GitHubIssueComment
      | GitHubPullRequestReviewComment
      | GitHubPullRequestReviewState
      | GitHubIssue
      | GitHubPullRequest,
    self: GitHubPullRequest | GitHubIssue | null
  ): CommentAssociation | CommentKind {
    let ret = 0;
    ret |= issueType;
    if (comment.id === self?.id) {
      ret |= CommentAssociation.SPECIFICATION;
    } else if (comment.user?.id === self?.user?.id) {
      ret |= CommentAssociation.AUTHOR;
    } else if (comment.user?.id === self?.assignee?.id) {
      ret |= CommentAssociation.ASSIGNEE;
    } else if (comment.author_association === "MEMBER" || comment.author_association === "COLLABORATOR") {
      ret |= CommentAssociation.COLLABORATOR;
    } else {
      ret |= CommentAssociation.CONTRIBUTOR;
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
              type: this._getTypeFromComment(CommentKind.PULL, review, linkedReview.self),
            });
          }
        } else if (value) {
          comments.push({
            ...value,
            type: this._getTypeFromComment(CommentKind.PULL, value, value),
          });
        }
      }
    }
    return comments;
  }

  get allComments() {
    const comments: Array<
      (GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest) & {
        type: CommentKind | CommentAssociation;
      }
    > = this.comments.map((comment) => ({
      ...comment,
      type: this._getTypeFromComment(CommentKind.ISSUE, comment, this.self),
    }));
    if (this.self) {
      comments.push({
        ...this.self,
        type: this._getTypeFromComment(CommentKind.ISSUE, this.self, this.self),
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

  constructor(
    private _context: ContextPlugin,
    private _pullParams: PullParams
  ) {}

  async init() {
    [this.self, this.reviews, this.reviewComments, this.comments] = await Promise.all([
      getPullRequest(this._context, this._pullParams),
      getPullRequestReviews(this._context, this._pullParams),
      getPullRequestReviewComments(this._context, this._pullParams),
      // This fetches all the comments inside the Pull Request that were not created in a reviewing context
      getIssueComments(this._context, {
        owner: this._pullParams.owner,
        repo: this._pullParams.repo,
        issue_number: this._pullParams.pull_number,
      }),
    ]);
  }
}
