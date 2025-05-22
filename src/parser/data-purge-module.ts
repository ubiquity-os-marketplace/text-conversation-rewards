import { DataPurgeConfiguration } from "../configuration/data-purge-config";
import { GitHubPullRequestReviewComment } from "../github-types";
import { getAssignmentPeriods, isCommentDuringAssignment, UserAssignments } from "../helpers/user-assigned-timespan";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { IssueEdits, QUERY_ISSUE_EDITS } from "../types/comment-edits";
import { BaseModule } from "../types/module";
import { Result } from "../types/results";
import { writeFileSync } from "fs";
import { getCharacterContributionPercentages } from "../helpers/diff-count";

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeModule extends BaseModule {
  readonly _configuration: DataPurgeConfiguration | null = this.context.config.incentives.dataPurge;
  _assignmentPeriods: UserAssignments = {};

  get enabled(): boolean {
    if (!this._configuration) {
      this.context.logger.warn("The configuration for the module DataPurgeModule is invalid or missing, disabling.");
      return false;
    }
    return true;
  }

  async _shouldSkipComment(comment: IssueActivity["allComments"][0]) {
    if ("isMinimized" in comment && comment.isMinimized) {
      this.context.logger.debug("Skipping hidden comment", { comment });
      return true;
    }
    if (
      this._configuration?.skipCommentsWhileAssigned &&
      this._configuration.skipCommentsWhileAssigned !== "none" &&
      comment.user?.login &&
      isCommentDuringAssignment(
        comment,
        this._assignmentPeriods[comment.user?.login],
        this._configuration.skipCommentsWhileAssigned === "exact"
      )
    ) {
      this.context.logger.debug("Skipping comment during assignment", {
        comment,
      });
      return true;
    }
    return false;
  }

  async _getOriginalAuthorshipPercentage() {
    const { owner, repo, issue_number } = parseGitHubUrl(this.context.payload.issue.html_url);
    const data = await this.context.octokit.graphql.paginate<IssueEdits>(QUERY_ISSUE_EDITS, {
      owner,
      repo,
      issue_number,
    });

    // const originalAuthor = this.context.payload.issue.user.login;
    const userEdits = data.repository.issue.userContentEdits.nodes.sort((a, b) => {
      return new Date(a.editedAt).getTime() - new Date(b.editedAt).getTime();
    });

    if (!userEdits.length) {
      this.context.logger.debug("No edits detected on the issue body, skipping.");
      process.exit(1);
      return 1;
    }

    const result = getCharacterContributionPercentages(userEdits);

    writeFileSync("edit-results.json", JSON.stringify(result, null, 2));
    writeFileSync("edit.json", JSON.stringify(userEdits, null, 2));
    process.exit(0);
    // return user ownership
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    this._assignmentPeriods = await getAssignmentPeriods(
      this.context.octokit,
      parseGitHubUrl(this.context.payload.issue.html_url)
    );
    await this._getOriginalAuthorshipPercentage();
    for (const comment of data.allComments) {
      if (await this._shouldSkipComment(comment)) {
        continue;
      }
      if (comment.body && comment.user?.login && result[comment.user.login]) {
        const newContent = comment.body
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
          // Keep only one new line needed by markdown-it package to convert to html
          .replace(/\n\s*\n/g, "\n")
          .trim();

        const reviewComment = comment as GitHubPullRequestReviewComment;

        if (newContent.length) {
          result[comment.user.login].comments = [
            ...(result[comment.user.login].comments ?? []),
            {
              id: comment.id,
              content: newContent,
              url: comment.html_url,
              commentType: comment.commentType,
              diffHunk: reviewComment?.pull_request_review_id ? reviewComment?.diff_hunk : undefined,
            },
          ];
        }
      }
    }
    return result;
  }
}
