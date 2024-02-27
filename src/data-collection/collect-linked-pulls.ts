import { GitHubLinkEvent, isGitHubLinkEvent } from "../github-types";
import { IssueParams, getAllTimelineEvents } from "../start";

export async function collectLinkedMergedPulls(issue: IssueParams) {
  // normally we should only use this one to calculate incentives, because this specifies that the pull requests are merged (accepted)
  const onlyPullRequests = await collectLinkedPulls(issue);
  return onlyPullRequests.filter((event) => isGitHubLinkEvent(event) && event.source.issue.pull_request?.merged_at);
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
