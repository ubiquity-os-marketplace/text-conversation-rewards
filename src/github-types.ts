import { RestEndpointMethodTypes } from "@octokit/rest";

export type GitHubIssue = RestEndpointMethodTypes["issues"]["get"]["response"]["data"];
export type GitHubPullRequest = RestEndpointMethodTypes["pulls"]["get"]["response"]["data"];
export type GitHubIssueComment = RestEndpointMethodTypes["issues"]["listComments"]["response"]["data"][0];
export type GitHubIssueEvent = RestEndpointMethodTypes["issues"]["listEvents"]["response"]["data"][0];
export type GitHubTimelineEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0];
export type GitHubRepository = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
export type GitHubUser = RestEndpointMethodTypes["users"]["getByUsername"]["response"]["data"];
export type GitHubPullRequestReviewState = RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"][0];
export type GitHubPullRequestReviewComment =
  RestEndpointMethodTypes["pulls"]["listReviewComments"]["response"]["data"][0];

type LinkPullRequestDetail = {
  url: "https://api.github.com/repos/ubiquibot/comment-incentives/pulls/25";
  html_url: "https://github.com/ubiquibot/comment-incentives/pull/25";
  diff_url: "https://github.com/ubiquibot/comment-incentives/pull/25.diff";
  patch_url: "https://github.com/ubiquibot/comment-incentives/pull/25.patch";
  merged_at: "2024-02-16T19:22:01Z";
};

type SourceIssueWithPullRequest =
  | GitHubIssue
  | ((GitHubPullRequest & { pull_request: LinkPullRequestDetail }) & { repository: GitHubRepository });

export type GitHubLinkEvent = RestEndpointMethodTypes["issues"]["listEventsForTimeline"]["response"]["data"][0] & {
  event: "connected" | "disconnected" | "cross-referenced";
  source: { issue: SourceIssueWithPullRequest };
};
export function isGitHubLinkEvent(event: GitHubTimelineEvent): event is GitHubLinkEvent {
  return "source" in event;
}
