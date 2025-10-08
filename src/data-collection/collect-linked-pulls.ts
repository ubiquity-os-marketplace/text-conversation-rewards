import { PullRequest, Repository, User } from "@octokit/graphql-schema";
import { IssueParams } from "../start";
import { ContextPlugin } from "../types/plugin-input";
import { LINKED_PULL_REQUESTS } from "../types/requests";

export type ClosedByPullRequestsReferences = {
  node: Pick<PullRequest, "url" | "title" | "number" | "state" | "body"> & {
    author: Pick<User, "login" | "id">;
    repository: Pick<Repository, "owner" | "name">;
    labels?: {
      nodes: {
        name: string;
        description: string;
      }[];
    };
  };
};

type IssueWithClosedByPrs = {
  repository: {
    issue: {
      closedByPullRequestsReferences: {
        edges: ClosedByPullRequestsReferences[];
      };
    };
  };
};

export async function collectLinkedPulls(context: ContextPlugin, issue: IssueParams, includeClosed: boolean = false) {
  const { octokit } = context;
  const { owner, repo, issue_number } = issue;

  const result = await octokit.graphql.paginate<IssueWithClosedByPrs>(LINKED_PULL_REQUESTS, {
    owner,
    repo,
    issue_number,
    $include_closed_prs: includeClosed,
  });

  return result.repository.issue.closedByPullRequestsReferences.edges.map((edge) => edge.node);
}
