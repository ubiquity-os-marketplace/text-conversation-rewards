import { IssueComment } from "@octokit/graphql-schema";
import { GitHubIssueComment } from "../github-types";
import { ContextPlugin } from "../types/plugin-input";
import { QUERY_COMMENT_DETAILS } from "../types/requests";

export async function getMinimizedCommentStatus(context: ContextPlugin, comments: GitHubIssueComment[]) {
  const { octokit } = context;
  const commentsData = await octokit.graphql<{ nodes?: IssueComment[] }>(QUERY_COMMENT_DETAILS, {
    node_ids: comments.map((o) => o.node_id),
  });

  if (commentsData.nodes?.length) {
    for (const commentNode of commentsData.nodes) {
      const comment = comments.find((o) => o.node_id === commentNode.id);
      // For each comment we add the 'isMinimized' info, which corresponds to a collapsed comment
      if (comment) {
        comment.isMinimized = commentNode.isMinimized;
      }
    }
  }
}
