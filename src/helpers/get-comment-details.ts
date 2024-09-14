import { GitHubIssueComment } from "../github-types";
import { getOctokitInstance } from "../octokit";
import { IssueComment } from "@octokit/graphql-schema";
import { QUERY_COMMENT_DETAILS } from "../types/requests";

export async function getMinimizedCommentStatus(comments: GitHubIssueComment[]) {
  const octokit = getOctokitInstance();

  for (const comment of comments) {
    const commentData = await octokit.graphql<{ node?: IssueComment }>(QUERY_COMMENT_DETAILS, {
      node_id: comment.node_id,
    });
    // For each comment we add the 'isMinimized' info, which corresponds to a collapsed comment
    if (commentData.node) {
      comment.isMinimized = commentData.node.isMinimized;
    }
  }
}
