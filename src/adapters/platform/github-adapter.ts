/**
 * GitHub platform adapter — implements PlatformActivity by wrapping IssueActivity.
 *
 * This adapter bridges the two worlds:
 *   - The existing GitHub-specific IssueActivity (unchanged, keeps all tests green)
 *   - The new platform-agnostic PlatformActivity interface (#385)
 *
 * Future evaluator modules should depend on PlatformActivity rather than
 * IssueActivity directly, so that swapping the platform adapter is sufficient
 * to re-target the reward pipeline at a different project-management tool.
 */

import { CommentAssociation } from "../../configuration/comment-types";
import { IssueActivity } from "../../issue-activity";
import { IssueParams } from "../../start";
import { ContextPlugin } from "../../types/plugin-input";
import { PlatformActivity, PlatformComment } from "./types";

export class GitHubPlatformAdapter implements PlatformActivity {
  readonly platformId = "github";

  /** Underlying IssueActivity — available for callers that still need GitHub types. */
  readonly issueActivity: IssueActivity;

  constructor(context: ContextPlugin, issueParams: IssueParams) {
    this.issueActivity = new IssueActivity(context, issueParams);
  }

  get specification(): string | null {
    return this.issueActivity.self?.body ?? null;
  }

  async init(): Promise<void> {
    await this.issueActivity.init();
  }

  /**
   * Returns all contributions normalised to PlatformComment.
   *
   * GitHub-specific fields (author_association, pull_request linkage, etc.)
   * are mapped to the generic authorRole vocabulary defined in PlatformActivity.
   */
  async getAllComments(): Promise<PlatformComment[]> {
    const raw = await this.issueActivity.getAllComments(/* includeLinkedMergedPullRequests */ true);

    return raw.map((comment): PlatformComment => {
      const authorRoleFromType = this._resolveAuthorRole(comment.commentType as number);
      return {
        id: String(comment.id ?? ""),
        body: comment.body ?? "",
        author: comment.user?.login ?? "unknown",
        timestamp: comment.timestamp,
        url: comment.html_url ?? "",
        authorRole: authorRoleFromType,
        isReview: Boolean("submitted_at" in comment && comment.submitted_at),
      };
    });
  }

  /**
   * Maps the bitfield commentType produced by IssueActivity._getTypeFromComment
   * to the platform-agnostic authorRole string.
   */
  private _resolveAuthorRole(
    commentType: number
  ): PlatformComment["authorRole"] {
    if (commentType & CommentAssociation.SPECIFICATION) return "specification";
    if (commentType & CommentAssociation.ASSIGNEE) return "assignee";
    if (commentType & CommentAssociation.COLLABORATOR) return "collaborator";
    return "contributor";
  }
}
