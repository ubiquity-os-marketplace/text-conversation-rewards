import { Octokit } from "@octokit/rest";
import { getOctokitInstance } from "../get-authentication-token";
import { GitHubLinkEvent, GitHubTimelineEvent } from "../github-types";
import { IssueParams } from "../start";

let octokit: Octokit;

export default async function linkPulls(issue: IssueParams) {
  octokit = getOctokitInstance();

  /**
   * we need to find the linked pull request.
   * * we first start by checking the current repository.
   * * for example, if the issue is in repository A and the pull request is opened against repository A,
   * * then we can look for the pull request events, based on most recently updated pull requests,
   * * for a timestamp match on a connected event.
   */

  const issueLinkEvents = await getLinkedEvents(issue);

  const latestIssueLinkEvent = getLatestLinkEvent(issueLinkEvents);

  if (latestIssueLinkEvent) {
    return latestIssueLinkEvent.source;
  } else {
    // there is no link event on the issue so no need to search.
    return null;
  }
}

async function getLinkedEvents(params: IssueParams): Promise<GitHubLinkEvent[]> {
  const issueEvents = await fetchEvents(params);
  const linkEvents = issueEvents.filter(connectedOrCrossReferenced);
  if (linkEvents.length === 0) {
    return [];
  }
  return linkEvents;
}

function getLatestLinkEvent(events: GitHubLinkEvent[]) {
  if (events.length === 0) {
    return null;
  } else {
    const event = events.pop();
    return event ? event : null;
  }
}

function connectedOrCrossReferenced(event: GitHubTimelineEvent): event is GitHubLinkEvent {
  return event.event === "connected" || event.event === "cross-referenced";
}

async function fetchEvents(params: IssueParams): Promise<GitHubTimelineEvent[]> {
  const response = await octokit.rest.issues.listEventsForTimeline(params);
  return response.data;
}
