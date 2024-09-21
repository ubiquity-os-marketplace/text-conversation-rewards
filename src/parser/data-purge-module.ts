import { Value } from "@sinclair/typebox/value";
import configuration from "../configuration/config-reader";
import { DataPurgeConfiguration, dataPurgeConfigurationType } from "../configuration/data-purge-config";
import logger from "../helpers/logger";
import { IssueActivity } from "../issue-activity";
import { Module, Result } from "./processor";
import { GitHubPullRequestReviewComment } from "../github-types";

/**
 * Removes the data in the comments that we do not want to be processed.
 */
export class DataPurgeModule implements Module {
  readonly _configuration: DataPurgeConfiguration | null = configuration.incentives.dataPurge;

  get enabled(): boolean {
    if (!Value.Check(dataPurgeConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for DataPurgeModule, disabling.");
      return false;
    }
    return true;
  }

  async transform(data: Readonly<IssueActivity>, result: Result) {
    for (const comment of data.allComments) {
      // Skips comments if they are minimized
      if ("isMinimized" in comment && comment.isMinimized) {
        logger.debug("Skipping hidden comment", { comment });
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
              type: comment.type,
              diffHunk: reviewComment?.pull_request_review_id ? reviewComment?.diff_hunk : undefined,
            },
          ];
        }
      }
    }
    return result;
  }
}
