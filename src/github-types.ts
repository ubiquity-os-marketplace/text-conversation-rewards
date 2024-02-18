import { RestEndpointMethodTypes } from "@octokit/rest";

export type GitHubIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type GitHubPullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
export type GitHubComment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0];
export type GitHubLabel = RestEndpointMethodTypes["issues"]["listLabelsOnIssue"]["response"]["data"][0];
export type GitHubIssueEvent = RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"][0];
export type GitHubIssueTimelineEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0];