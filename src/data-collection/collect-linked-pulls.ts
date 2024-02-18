import { Octokit } from "@octokit/rest";
import { getOctokitInstance } from "../get-authentication-token";
import { GitHubLinkEvent, GitHubTimelineEvent, isGitHubLinkEvent } from "../github-types";
import { IssueParams } from "../start";

let octokit: Octokit;

export default async function collectLinkedPulls(issue: IssueParams) {
  octokit = getOctokitInstance();
  const issueLinkEvents = await getLinkedEvents(issue);
  const onlyConnected = eliminateDisconnects(issueLinkEvents);
  const onlyPullRequests = onlyConnected.filter((event) => isGitHubLinkEvent(event) && event.source.issue.pull_request);
  return onlyPullRequests.filter((event) => isGitHubLinkEvent(event) && event.source.issue.pull_request?.merged_at);
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
  const issueEvents = await fetchEvents(params);
  return issueEvents.filter(isGitHubLinkEvent);
}

// function getLatestLinkEvent(events: GitHubLinkEvent[]) {
//   if (events.length === 0) {
//     return null;
//   } else {
//     const event = events.pop();
//     return event ? event : null;
//   }
// }

// function connectedOrCrossReferenced(event: GitHubTimelineEvent): event is GitHubLinkEvent {
//   return event.event === "connected" || event.event === "cross-referenced";
// }

async function fetchEvents(params: IssueParams, page: number = 1, perPage: number = 100): Promise<GitHubTimelineEvent[]> {
  const response = await octokit.rest.issues.listEventsForTimeline({
    ...params,
    page,
    per_page: perPage,
  });
  return response.data;
}
