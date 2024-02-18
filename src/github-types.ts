import { RestEndpointMethodTypes } from "@octokit/rest";

export type GitHubIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type GitHubComment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0];
export type GitHubLabel = RestEndpointMethodTypes["issues"]["listLabelsOnIssue"]["response"]["data"][0];