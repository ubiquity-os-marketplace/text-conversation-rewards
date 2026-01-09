import { CommentAssociation, CommentKind } from "./configuration/comment-types";
import { DataCollectionConfiguration } from "./configuration/data-collection-config";
import {
  ClosedByPullRequestsReferences,
  collectLinkedPulls,
  LinkedPullRequest,
} from "./data-collection/collect-linked-pulls";
import {
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueEvent,
  GitHubPullRequest,
  GitHubPullRequestReviewComment,
  GitHubPullRequestReviewState,
} from "./github-types";
import { areLoginsEquivalent } from "./helpers/github";
import { isPullRequestEvent } from "./helpers/type-assertions";
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
import { isPullRequest } from "./types/module";
import { ContextPlugin } from "./types/plugin-input";
import { LINKED_ISSUES, PullRequestClosingIssue } from "./types/requests";

type BaseComment = GitHubIssueComment | GitHubPullRequestReviewComment | GitHubIssue | GitHubPullRequest;

type AugmentedComment = BaseComment & {
  commentType: CommentKind | CommentAssociation;
  timestamp: string;
  html_url?: string;
  id?: number;
};

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
  linkedMergedPullRequests: PullRequest[] = [];
  linkedIssues: ClosedByPullRequestsReferences[] = [];

  async init() {
    if (this.self) {
      this._context.logger.debug("The Issue Activity is already initialized.");
      return;
    }
    try {
      [this.self, this.events, this.comments, this.linkedMergedPullRequests, this.linkedIssues] = await Promise.all([
        getIssue(this._context, this._issueParams),
        getIssueEvents(this._context, this._issueParams),
        getIssueComments(this._context, this._issueParams),
        this._getLinkedPullRequests(),
        this._getLinkedIssues(),
      ]);
    } catch (error) {
      throw this._context.logger.error(`Could not fetch issue data: ${error}`);
    }
  }

  private async _getLinkedIssues(): Promise<ClosedByPullRequestsReferences[]> {
    if (!isPullRequest(this._context)) {
      return [];
    }

    const pullNumber = this._issueParams.issue_number;
    const owner = this._context.payload.repository.owner.login;
    const repo = this._context.payload.repository.name;
    if (!pullNumber) {
      return [];
    }
    const linked = await this._context.octokit.graphql.paginate<PullRequestClosingIssue>(LINKED_ISSUES, {
      owner,
      repo,
      pull_number: pullNumber,
    });

    return linked.repository.pullRequest.closingIssuesReferences.edges ?? [];
  }

  private async _getLinkedPullRequests(): Promise<PullRequest[]> {
    this._context.logger.info("Trying to fetch linked pull-requests for", this._issueParams);

    const pulls: string[] = [];
    if (isPullRequestEvent(this._context)) {
      pulls.push(this._context.payload.pull_request.html_url);
    } else if ("issue" in this._context.payload && this._context.payload.issue.pull_request?.html_url) {
      pulls.push(this._context.payload.issue.pull_request.html_url);
    } else {
      const issueAssigneeLogins =
        "issue" in this._context.payload
          ? (this._context.payload.issue.assignees ?? [])
              .map((assignee) => assignee?.login)
              .filter((login): login is string => Boolean(login))
          : [];
      const linkedPulls: LinkedPullRequest[] = await collectLinkedPulls(this._context, this._issueParams);
      const linkedPullUrls = linkedPulls
        .filter((pullRequest) => {
          // This can happen when a user deleted its account
          if (!pullRequest?.author?.login) {
            return false;
          }
          if (pullRequest.state !== "MERGED") {
            return false;
          }

          const specialUserGroups = this._context.config.incentives.specialUsers ?? [];
          return issueAssigneeLogins.some((assigneeLogin) =>
            areLoginsEquivalent(assigneeLogin, pullRequest.author.login, specialUserGroups)
          );
        })
        .map((pullRequest) => pullRequest.url);
      pulls.push(...linkedPullUrls);
    }
    this._context.logger.info(`Collected linked pull-requests: ${pulls.join(", ")}`);

    const promises = pulls
      .map(async (pull) => {
        const { owner, repo, issue_number } = parseGitHubUrl(pull);
        if (!owner) {
          this._context.logger.warn(`No repository found.`, { pull });
          return null;
        } else {
          const pullParams = {
            owner: owner,
            repo: repo,
            pull_number: issue_number,
          };
          const review = new PullRequest(this._context, pullParams);
          await review.init();
          return review;
        }
      })
      .filter((o) => o !== null) as Promise<PullRequest>[];
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

  private async _processSingleLinkedPullRequest(linkedPullRequest: PullRequest) {
    const comments = [];
    for (const value of Object.values(linkedPullRequest)) {
      if (Array.isArray(value)) {
        for (const review of value) {
          this._addAnchorToUrl(review);
          comments.push({
            ...review,
            timestamp: review.submitted_at ?? review.created_at,
            commentType: this._getTypeFromComment(CommentKind.PULL, review, linkedPullRequest.self),
          });
        }
      } else if (value) {
        this._addAnchorToUrl(value);
        const c = {
          ...value,
          timestamp: value.submitted_at ?? value.created_at,
          commentType: this._getTypeFromComment(CommentKind.PULL, value, value),
        };
        await this._tryAddLinkedComment(c, comments);
      }
    }
    return comments;
  }

  private async _tryAddLinkedComment(comment: AugmentedComment, comments: Array<AugmentedComment>) {
    if (!isPullRequest(this._context)) {
      if (comment.commentType & CommentAssociation.SPECIFICATION && comment.html_url) {
        const { owner, repo, issue_number } = parseGitHubUrl(comment.html_url);
        const { data } = await this._context.octokit.rest.issues.get({
          owner,
          repo,
          issue_number: issue_number,
        });
        comment.id = data.id;
        this._addAnchorToUrl(comment);
      }
      comments.push(comment);
    }
  }

  async _getLinkedPullRequestComments() {
    const commentPromises = this.linkedMergedPullRequests.map((linkedPullRequest) =>
      this._processSingleLinkedPullRequest(linkedPullRequest)
    );
    const commentsArrays = await Promise.all(commentPromises);
    return commentsArrays.flat();
  }

  async getAllComments(includeLinkedMergedPullRequests: boolean = false) {
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
    if (includeLinkedMergedPullRequests && this.linkedMergedPullRequests) {
      const linkedPrComments = await this._getLinkedPullRequestComments();
      comments.push(...linkedPrComments);
    }
    const seen = new Set<string>();
    return comments.filter((c) => {
      const htmlUrl = c.html_url;
      if (!htmlUrl) return false;
      const { owner, repo, issue_number } = parseGitHubUrl(htmlUrl);
      const key = `${owner}/${repo}/${issue_number}/${c.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export class PullRequest {
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
