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
  parseGitHubUrl,
  PullParams,
} from "./start";
import { ContextPlugin } from "./types/plugin-input";
import { isPullRequestEvent } from "./helpers/type-assertions";

export class IssueActivity {
  protected readonly _context: ContextPlugin;
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
      throw this._context.logger.error(`Could not fetch issue data: ${error}`);
    }
  }

  private async _getLinkedReviews(): Promise<Review[]> {
    this._context.logger.debug("Trying to fetch linked pull-requests for", this._issueParams);

    const pulls: string[] = [];
    if (isPullRequestEvent(this._context)) {
      pulls.push(this._context.payload.pull_request.html_url);
    } else if ("issue" in this._context.payload && this._context.payload.issue.pull_request?.html_url) {
      pulls.push(this._context.payload.issue.pull_request.html_url);
    } else {
      pulls.push(
        ...(await collectLinkedMergedPulls(this._context, this._issueParams))
          .filter((pullRequest) => {
            // This can happen when a user deleted its account
            if (!pullRequest?.author?.login) {
              return false;
            }
            return (
              "issue" in this._context.payload &&
              this._context.payload.issue.assignees
                .map((assignee) => assignee?.login)
                .includes(pullRequest.author.login) &&
              pullRequest.state === "MERGED"
            );
          })
          .map((pullRequest) => pullRequest.url)
      );
    }
    this._context.logger.debug(`Collected linked pull-requests: ${pulls.join(", ")}`);

    const promises = pulls
      .map(async (pull) => {
        const { owner, repo, issue_number } = parseGitHubUrl(pull);
        if (!owner) {
          this._context.logger.error(`No repository found.`, { pull });
          return null;
        } else {
          const pullParams = {
            owner: owner,
            repo: repo,
            pull_number: issue_number,
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

  private _addAnchorToUrl(item: { html_url?: string; id?: number }) {
    if (!item.html_url || !item.id) {
      return;
    }

    const hashIndex = item.html_url.indexOf("#");

    if (hashIndex === -1) {
      item.html_url += `#issue-${item.id}`;
    } else {
      item.html_url = item.html_url.replace(/\d+$/, String(item.id));
    }
  }

  private async _processSingleLinkedReview(linkedReview: Review) {
    const comments = [];
    for (const value of Object.values(linkedReview)) {
      if (Array.isArray(value)) {
        for (const review of value) {
          this._addAnchorToUrl(review);
          comments.push({
            ...review,
            timestamp: review.submitted_at ?? review.created_at,
            commentType: this._getTypeFromComment(CommentKind.PULL, review, linkedReview.self),
          });
        }
      } else if (value) {
        this._addAnchorToUrl(value);
        const c = {
          ...value,
          timestamp: value.submitted_at ?? value.created_at,
          commentType: this._getTypeFromComment(CommentKind.PULL, value, value),
        };
        // We avoid adding the body if we already are evaluating a pull-request as it would be contained in the issue
        if (
          !(
            "pull_Request" in this._context.payload ||
            ("issue" in this._context.payload && this._context.payload.issue.pull_request)
          )
        ) {
          // Special case for anchoring with pull-request bodies that have to be retrieved differently
          if (c.commentType & CommentAssociation.SPECIFICATION && c.html_url) {
            const { owner, repo, issue_number } = parseGitHubUrl(c.html_url);
            const { data } = await this._context.octokit.rest.issues.get({
              owner,
              repo,
              issue_number: issue_number,
            });
            c.id = data.id;
            this._addAnchorToUrl(c);
          }
          comments.push(c);
        }
      }
    }
    return comments;
  }

  async _getLinkedReviewComments() {
    const commentPromises = this.linkedReviews.map((linkedReview) => this._processSingleLinkedReview(linkedReview));
    const commentsArrays = await Promise.all(commentPromises);
    return commentsArrays.flat();
  }

  async getAllComments() {
    const comments: Array<
      (GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest) & {
        commentType: CommentKind | CommentAssociation;
        timestamp: string;
      }
    > = this.comments.map((comment) => {
      this._addAnchorToUrl(comment);
      return {
        ...comment,
        timestamp: comment.created_at,
        commentType: this._getTypeFromComment(
          this.self?.pull_request ? CommentKind.PULL : CommentKind.ISSUE,
          comment,
          this.self
        ),
      };
    });
    if (this.self) {
      const c: GitHubIssue = this.self;
      this._addAnchorToUrl(c);
      comments.push({
        ...c,
        timestamp: c.created_at,
        commentType: this._getTypeFromComment(
          this.self?.pull_request ? CommentKind.PULL : CommentKind.ISSUE,
          this.self,
          this.self
        ),
      });
    }
    if (this.linkedReviews) {
      const linkedComments = await this._getLinkedReviewComments();
      comments.push(...linkedComments);
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
