import { Octokit } from "@octokit/rest";
import { getOctokitInstance } from "../get-authentication-token";
import { GitHubIssueTimelineEvent } from "../github-types";
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

  console.dir({ latestIssueLinkEvent }, { depth: null });

  if (latestIssueLinkEvent) {
    const linkedPullRequest = await findMatchingLinkEventFromPullRequests(issue, latestIssueLinkEvent.created_at);
    if (!linkedPullRequest) {
      // we need to search across the other repositories in the organization
      // get all the repositories in the organization, sorted by most recently updated via pull requests
      // then search for the linked pull request event from those pull requests.
      return await findMatchingLinkEventFromOtherRepositories(issue, latestIssueLinkEvent.created_at);
    }
  } else {
    // there is no link event on the issue so no need to search.
    return null;
  }
}

async function findMatchingLinkEventFromOtherRepositories(issue: IssueParams, timestamp: string) {
  const orgRepos = await octokit.repos.listForOrg({ org: issue.owner, sort: "updated", direction: "desc" });

  for (const repo of orgRepos.data) {
    const otherRepoPullRequests = await octokit.pulls.list({
      owner: issue.owner,
      repo: repo.name,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 10,
    });

    for (const pullRequest of otherRepoPullRequests.data) {
      const pullRequestLinkEvents = await getLinkedEvents({ owner: issue.owner, repo: repo.name, issue_number: pullRequest.number });
      const latestPullRequestLinkEvent = getLatestLinkEvent(pullRequestLinkEvents);

      console.debug({ latestPullRequestLinkEvent });

      if (latestPullRequestLinkEvent?.created_at === timestamp) {
        return pullRequest;
      }
    }
  }

  return null;
}

async function getLinkedEvents(params: IssueParams) {
  const issueEvents = await fetchEvents(params);
  console.dir(`===== start =====`, { depth: null });
  const linkEvents = issueEvents.filter((event) => {
    console.dir({ event: event.event }, { depth: null });
    return connectedOrCrossReferenced(event);
  });
  console.dir(`===== finish =====`, { depth: null });
  if (linkEvents.length === 0) {
    return [];
  }
  return linkEvents;
}

function getLatestLinkEvent(events: GitHubIssueTimelineEvent[]) {
  if (events.length === 0) {
    return null;
  } else {
    return events.shift();
  }
}

// make sure to find a matching event in the list of pull requests. go through each one at a time.
// if the pull request is not in the same repository, we need to find the repository where the pull request was opened.
async function findMatchingLinkEventFromPullRequests(params: IssueParams, timestamp: string) {
  // this searches the entire first page of results for matching link events.
  const pullRequests = await getClosedPullRequests(params);

  for (const pullRequest of pullRequests) {
    const pullRequestEvents = await fetchEvents({
      owner: pullRequest.base.repo.owner.login,
      repo: pullRequest.base.repo.name,
      issue_number: pullRequest.number,
    });
    const connectedEvents = pullRequestEvents.filter((event) => connectedOrCrossReferenced(event) && event.created_at === timestamp);
    const disconnectedEvents = pullRequestEvents.filter((event) => event.event === "disconnected");
    if (connectedEvents.length > 0 && disconnectedEvents.length === 0) {
      return pullRequest;
    }
  }

  return null;
}

function connectedOrCrossReferenced(event: GitHubIssueTimelineEvent) {
  return event.event === "connected" || event.event === "cross-referenced";
}

async function fetchEvents(params: IssueParams): Promise<GitHubIssueTimelineEvent[]> {
  const response = await octokit.rest.issues.listEventsForTimeline(params);
  return response.data;
}

async function getClosedPullRequests(params: IssueParams) {
  // when the linked pull request is merged, it is automatically closed
  const response = await octokit.rest.pulls.list({
    owner: params.owner,
    repo: params.repo,
    state: "closed",
    sort: "updated",
    direction: "desc",
    per_page: 10,
  });
  return response.data;
}
