import { CommentAssociation, CommentKind } from "../configuration/comment-types";
import { DataPurgeConfiguration } from "../configuration/data-purge-config";
import { GitHubPullRequestReviewComment } from "../github-types";
import { getAssignmentPeriods, isCommentDuringAssignment, UserAssignments } from "../helpers/user-assigned-timespan";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { Result, GithubCommentScore as ResultComment } from "../types/results";

type CommentType = Awaited<ReturnType<IssueActivity["getAllComments"]>>[0];

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeModule extends BaseModule {
  readonly _configuration: DataPurgeConfiguration | null = this.context.config.incentives.dataPurge;
  _assignmentPeriods: UserAssignments = {};
  _currentAssigneeLogins = new Set<string>();

  get enabled(): boolean {
    if (!this._configuration) {
      this.context.logger.warn("The configuration for the module DataPurgeModule is invalid or missing, disabling.");
      return false;
    }
    return true;
  }

  async _shouldSkipComment(comment: Awaited<ReturnType<IssueActivity["getAllComments"]>>[0]) {
    if ("isMinimized" in comment && comment.isMinimized) {
      this.context.logger.debug("Skipping hidden comment", { comment });
      return true;
    }
    if (
      this._configuration?.skipCommentsWhileAssigned &&
      this._configuration.skipCommentsWhileAssigned !== "none" &&
      comment.user?.login &&
      this._shouldCheckAssignmentWindow(comment) &&
      !(comment.commentType & CommentAssociation.SPECIFICATION) &&
      isCommentDuringAssignment(
        comment,
        this._assignmentPeriods[comment.user?.login],
        this._configuration.skipCommentsWhileAssigned === "exact"
      )
    ) {
      this.context.logger.debug("Skipping comment during assignment", {
        body: comment.body?.replace(/(.{100})..+/, "$1…"),
        url: comment.html_url,
      });
      return true;
    }
    return false;
  }

  private _shouldCheckAssignmentWindow(comment: CommentType) {
    if (!comment.user?.login) {
      return false;
    }
    const issue = "issue" in this.context.payload ? this.context.payload.issue : null;
    if (
      !this._configuration?.skipCommentsWhileAssignedForCurrentAssigneeOnly ||
      this.context.eventName !== "issues.closed" ||
      !issue ||
      !(comment.commentType & CommentKind.ISSUE)
    ) {
      return true;
    }
    if (issue.state_reason === "not_planned") {
      return false;
    }
    return this._currentAssigneeLogins.has(comment.user.login);
  }

  private _cleanCommentBody(body: string): string {
    const urlRegex = /(?<!]\(|["'=])(https?:\/\/[^\s<>"'\]]+)(?!\)|["'])/gi;
    return (
      body
        // Remove quoted text
        .replace(/^>.*$/gm, "")
        // Remove commands such as /start
        .replace(/^\/.+/g, "")
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, "")
        // Remove the footnotes
        .replace(/^###### .*?\[\^\d+\^][\s\S]*$/gm, "")
        .replace(/^\[\^[\w-]+\^?]:.*$/gm, "")
        .replace(/\[\^[\w-]+\^?]/g, "")
        // Make sure links are all in the MD link format, except the ones contained in HTML elements
        .replaceAll(urlRegex, "[$1]($1)")
        .trim()
    );
  }

  private _createResultComment(comment: CommentType, newContent: string): ResultComment | null {
    if (!newContent.length) {
      return null;
    }
    const reviewComment = comment as GitHubPullRequestReviewComment;
    // submitted_at applies only for review comments
    const timestamp =
      "submitted_at" in comment && typeof comment.submitted_at === "string" ? comment.submitted_at : comment.created_at;

    return {
      id: comment.id,
      content: newContent,
      url: comment.html_url,
      timestamp: timestamp,
      commentType: comment.commentType,
      diffHunk: reviewComment?.pull_request_review_id ? reviewComment?.diff_hunk : undefined,
    };
  }

  private async _processComment(comment: CommentType, result: Result): Promise<void> {
    if (await this._shouldSkipComment(comment)) {
      return;
    }

    const userLogin = comment.user?.login;
    if (comment.body && userLogin && result[userLogin]) {
      const cleanedBody = this._cleanCommentBody(comment.body);
      const resultComment = this._createResultComment(comment, cleanedBody);

      if (resultComment) {
        result[userLogin].comments = [...(result[userLogin].comments ?? []), resultComment];
      }
    }
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    const htmlUrl =
      "pull_request" in this.context.payload
        ? this.context.payload.pull_request.html_url
        : this.context.payload.issue.html_url;
    this._currentAssigneeLogins = new Set((data.self?.assignees ?? []).map((assignee) => assignee.login));
    this._assignmentPeriods = await getAssignmentPeriods(this.context.octokit, parseGitHubUrl(htmlUrl));
    const allComments = await data.getAllComments(this.isPullRequest());
    for (const comment of allComments) {
      await this._processComment(comment, result);
    }
    return result;
  }
}
