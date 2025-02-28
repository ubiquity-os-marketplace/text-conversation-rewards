import { RestEndpointMethodTypes } from "@octokit/rest";

export type GitHubIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type GitHubPullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
export type GitHubIssueComment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0] & {
  isMinimized?: boolean;
};
export type GitHubIssueEvent = RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"][0];
export type GitHubRepository = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
export type GitHubPullRequestReviewState = RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][0];
export type GitHubPullRequestReviewComment =
  RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][0];
export type GithubDiff = RestEndpointMethodTypes["repos"]["compareCommits"]["response"];
