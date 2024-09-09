import { PullRequest, Repository, User } from "@octokit/graphql-schema";
import { getOctokitInstance } from "../octokit";
import { IssueParams } from "../start";
import { LINKED_PULL_REQUESTS } from "../types/requests";

type ClosedByPullRequestsReferences = {
  node: Pick<PullRequest, "url" | "title" | "number" | "state" | "body"> & {
    author: Pick<User, "login" | "id">;
    repository: Pick<Repository, "owner" | "name">;
  };
};

type IssueWithClosedByPRs = {
  repository: {
    issue: {
      closedByPullRequestsReferences: {
        edges: ClosedByPullRequestsReferences[];
      };
    };
  };
};

export async function collectLinkedMergedPull(issue: IssueParams) {
  const octokit = getOctokitInstance();
  const { owner, repo, issue_number } = issue;

  const result = await octokit.graphql.paginate<IssueWithClosedByPRs>(LINKED_PULL_REQUESTS, {
    owner,
    repo,
    issue_number,
  });

  return result.repository.issue.closedByPullRequestsReferences.edges.map((edge) => edge.node).slice(-1);
}
