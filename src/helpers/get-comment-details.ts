import { IssueComment } from "@octokit/graphql-schema";
import { GitHubIssueComment } from "../github-types";
import { ContextPlugin } from "../types/plugin-input";
import { QUERY_COMMENT_DETAILS } from "../types/requests";

export async function getMinimizedCommentStatus(context: ContextPlugin, comments: GitHubIssueComment[]) {
  const { octokit } = context;
  // 100 is the maximum amount of nodes that can be passed to the gql request, anything above will crash it.
  const CHUNK_SIZE = 100;
  const commentNodes: IssueComment[] = [];

  for (let i = 0; i < comments.length; i += CHUNK_SIZE) {
    const chunk = comments.slice(i, i + CHUNK_SIZE);

    const commentsData = await octokit.graphql<{ nodes?: IssueComment[] }>(QUERY_COMMENT_DETAILS, {
      node_ids: chunk.map((o) => o.node_id),
    });

    if (commentsData?.nodes?.length) {
      commentNodes.push(...commentsData.nodes);
    }
  }

  for (const commentNode of commentNodes) {
    const comment = comments.find((o) => o.node_id === commentNode.id);
    if (comment) {
      comment.isMinimized = commentNode.isMinimized;
    }
  }
}
