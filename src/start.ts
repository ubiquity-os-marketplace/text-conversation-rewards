import { getOctokitInstance } from "./octokit";
import {
  GitHubIssue,
  GitHubIssueComment,
  GitHubIssueEvent,
  GitHubPullRequest,
  GitHubPullRequestReviewComment,
  GitHubPullRequestReviewState,
  GitHubRepository,
} from "./github-types";
import { getMinimizedCommentStatus } from "./helpers/get-comment-details";

// async function main(gitHubIssueUrl: GitHubIssue["html_url"]) {
// const issueParams = parseGitHubUrl(gitHubIssueUrl);
// const issue = await getIssue(issueParams);
// const pullRequestLinks = await collectLinkedPulls(issueParams);
// const pullRequestDetails = await Promise.all(
//   pullRequestLinks.map((link) =>
//     getPullRequest({
//       owner: link.source.issue.repository.owner.login,
//       repo: link.source.issue.repository.name,
//       pull_number: link.source.issue.number,
//     })
//   )
// );

// const users = await getTimelineUsers(issueParams);
// const users = getUsers(issueParams, pullRequestDetails);

// const usersByType = {
//   assignees: users.filter((user) => user.isAssignee),
//   authors: users.filter((user) => user.isAuthor),
//   collaborators: users.filter((user) => user.isCollaborator),
//   remainder: users.filter((user) => user.isRemainder),
// };

/**
   * gather context
   * * this includes:

   * * * the github issue,
  * * * * comments

  * * * the linked pull request
  * * * * comments
  * * * * commits
  * * * * reviews
  * * * * review comments

  * * * the users
   * * * * isAssignee?
   * * * * isAuthor?
   * * * * isCollaborator?
   * * * * isRemainder?
   */
// }
export type IssueParams = ReturnType<typeof parseGitHubUrl>;
export type PullParams = { owner: string; repo: string; pull_number: number };

export async function getRepo(params: IssueParams): Promise<GitHubRepository> {
  const octokit = getOctokitInstance();
  return (await octokit.repos.get(params)).data;
}

export async function getIssue(params: IssueParams): Promise<GitHubIssue> {
  const octokit = getOctokitInstance();
  return (await octokit.issues.get(params)).data;
}

export async function getPullRequest(pullParams: PullParams): Promise<GitHubPullRequest> {
  const octokit = getOctokitInstance();
  return (await octokit.pulls.get(pullParams)).data;
}

export async function getIssueEvents(issueParams: IssueParams): Promise<GitHubIssueEvent[]> {
  const octokit = getOctokitInstance();
  return await octokit.paginate(octokit.issues.listEvents.endpoint.merge(issueParams));
}

export async function getIssueComments(issueParams: IssueParams): Promise<GitHubIssueComment[]> {
  const octokit = getOctokitInstance();
  const comments: GitHubIssueComment[] = await octokit.paginate(
    octokit.issues.listComments.endpoint.merge(issueParams)
  );
  await getMinimizedCommentStatus(comments);
  return comments;
}
export async function getPullRequestReviews(pullParams: PullParams): Promise<GitHubPullRequestReviewState[]> {
  const octokit = getOctokitInstance();
  return await octokit.paginate(octokit.pulls.listReviews.endpoint.merge(pullParams));
}
export async function getPullRequestReviewComments(pullParams: PullParams): Promise<GitHubPullRequestReviewComment[]> {
  const octokit = getOctokitInstance();
  return await octokit.paginate(octokit.pulls.listReviewComments.endpoint.merge(pullParams));
}

export function parseGitHubUrl(url: string): { owner: string; repo: string; issue_number: number } {
  const path = new URL(url).pathname.split("/");
  if (path.length !== 5) {
    throw new Error(`[parseGitHubUrl] Invalid url: [${url}]`);
  }
  return {
    owner: path[1],
    repo: path[2],
    issue_number: Number(path[4]),
  };
}
