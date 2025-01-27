import { PullRequest, Repository, User } from "@octokit/graphql-schema";
import { IssueParams } from "../start";
import { ContextPlugin } from "../types/plugin-input";
import { LINKED_PULL_REQUESTS } from "../types/requests";

type ClosedByPullRequestsReferences = {
  node: Pick<PullRequest, "url" | "title" | "number" | "state" | "body"> & {
    author: Pick<User, "login" | "id">;
    repository: Pick<Repository, "owner" | "name">;
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

export async function collectLinkedMergedPulls(context: ContextPlugin, issue: IssueParams) {
  const { octokit } = context;
  const { owner, repo, issue_number } = issue;

  const result = await octokit.graphql.paginate<IssueWithClosedByPrs>(LINKED_PULL_REQUESTS, {
    owner,
    repo,
    issue_number,
  });

  return result.repository.issue.closedByPullRequestsReferences.edges.map((edge) => edge.node);
}
