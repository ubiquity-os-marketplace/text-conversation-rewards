import type { ContextPlugin } from "./types/plugin-input";

type OctokitInstance = ContextPlugin["octokit"];
type RestApi = OctokitInstance["rest"];

export type GitHubIssue = Awaited<ReturnType<RestApi["issues"]["get"]>>["data"];
export type GitHubPullRequest = Awaited<ReturnType<RestApi["pulls"]["get"]>>["data"];
export type GitHubIssueComment = Awaited<ReturnType<RestApi["issues"]["listComments"]>>["data"][0] & {
  isMinimized?: boolean;
};
export type GitHubIssueEvent = Awaited<ReturnType<RestApi["issues"]["listEvents"]>>["data"][0];
export type GitHubRepository = Awaited<ReturnType<RestApi["repos"]["get"]>>["data"];
export type GitHubPullRequestReviewState = Awaited<ReturnType<RestApi["pulls"]["listReviews"]>>["data"][0];
export type GitHubPullRequestReviewComment = Awaited<ReturnType<RestApi["pulls"]["listReviewComments"]>>["data"][0];
