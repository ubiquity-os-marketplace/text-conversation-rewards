import { PullRequest, Repository, User } from "@octokit/graphql-schema";
import { GitHubLinkEvent, isGitHubLinkEvent } from "../github-types";
import { getOctokitInstance } from "../octokit";
import { getAllTimelineEvents, IssueParams } from "../start";
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

export async function collectLinkedMergedPulls(issue: IssueParams) {
  const octokit = getOctokitInstance();
  const { owner, repo, issue_number } = issue;

  const result = await octokit.graphql.paginate<IssueWithClosedByPRs>(LINKED_PULL_REQUESTS, {
    owner,
    repo,
    issue_number,
  });

  return result.repository.issue.closedByPullRequestsReferences.edges.map((edge) => edge.node);
}

export async function collectLinkedPulls(issue: IssueParams) {
  // this one was created to help with tests, but probably should not be used in the main code
  const issueLinkEvents = await getLinkedEvents(issue);
  const onlyConnected = eliminateDisconnects(issueLinkEvents);
  return onlyConnected.filter((event) => isGitHubLinkEvent(event) && event.source.issue.pull_request);
}

function eliminateDisconnects(issueLinkEvents: GitHubLinkEvent[]) {
  // Track connections and disconnections
  const connections = new Map<number, GitHubLinkEvent>(); // Use issue/pr number as key for easy access
  const disconnections = new Map<number, GitHubLinkEvent>(); // Track disconnections

  issueLinkEvents.forEach((issueEvent: GitHubLinkEvent) => {
    const issueNumber = issueEvent.source.issue.number as number;

    if (issueEvent.event === "connected" || issueEvent.event === "cross-referenced") {
      // Only add to connections if there is no corresponding disconnected event
      if (!disconnections.has(issueNumber)) {
        connections.set(issueNumber, issueEvent);
      }
    } else if (issueEvent.event === "disconnected") {
      disconnections.set(issueNumber, issueEvent);
      // If a disconnected event is found, remove the corresponding connected event
      if (connections.has(issueNumber)) {
        connections.delete(issueNumber);
      }
    }
  });

  return Array.from(connections.values());
}

async function getLinkedEvents(params: IssueParams): Promise<GitHubLinkEvent[]> {
  const issueEvents = await getAllTimelineEvents(params);
  return issueEvents.filter(isGitHubLinkEvent);
}
