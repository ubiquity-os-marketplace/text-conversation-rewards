import { Octokit } from "@octokit/rest";
// import fs from 'fs';
// import path from "path";
import { getOctokitInstance } from "../get-authentication-token";
import { GitHubIssueEvent, GitHubLinkEvent, GitHubTimelineEvent } from "../github-types";
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

  const connected = eliminateDisconnects(issueLinkEvents);

  // Convert the object to a string with indentation
  // const data = util.inspect(issueLinkEvents, { depth: null, colors: false });

  // Write the data to a file
  // fs.writeFileSync(path.join(__dirname, 'temp-log.json'), JSON.stringify(issueLinkEvents, null, 2));
  // console.dir({ issueLinkEvents }, { depth: null });

  const onlyPullRequests = connected.filter((event) => event.source.issue.pull_request);
  const latestIssueLinkEvent = getLatestLinkEvent(onlyPullRequests);

  if (latestIssueLinkEvent) {
    return latestIssueLinkEvent.source;
  } else {
    // there is no link event on the issue so no need to search.
    return null;
  }
}

function eliminateDisconnects(issueLinkEvents: GitHubLinkEvent[]) {
  // Track connections and disconnections
  const connections = new Map<number, GitHubIssueEvent>(); // Use issue/pr number as key for easy access
  const disconnections = new Map<number, GitHubIssueEvent>(); // Track disconnections

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
  const linkEvents = issueEvents.filter(connectedOrCrossReferenced); // @TODO: make sure to filter out matching disconnected for any connected events

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
