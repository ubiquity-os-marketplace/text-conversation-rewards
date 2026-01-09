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
import { ContextPlugin } from "./types/plugin-input";

/**
   * gather context
   * * this includes:

   * * * the GitHub issue,
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
export type IssueParams = ReturnType<typeof parseGitHubUrl>;
export type PullParams = { owner: string; repo: string; pull_number: number };

export async function getRepo(context: ContextPlugin, params: IssueParams): Promise<GitHubRepository> {
  const { octokit } = context;
  return (await octokit.rest.repos.get(params)).data;
}

export async function getIssue(context: ContextPlugin, params: IssueParams): Promise<GitHubIssue> {
  const { octokit } = context;
  return (await octokit.rest.issues.get(params)).data;
}

export async function getPullRequest(context: ContextPlugin, pullParams: PullParams): Promise<GitHubPullRequest> {
  const { octokit } = context;
  return (await octokit.rest.pulls.get(pullParams)).data as GitHubPullRequest;
}

export async function getIssueEvents(context: ContextPlugin, issueParams: IssueParams): Promise<GitHubIssueEvent[]> {
  const { octokit } = context;
  return await octokit.paginate(octokit.rest.issues.listEvents.endpoint.merge(issueParams));
}

export async function getIssueComments(
  context: ContextPlugin,
  issueParams: IssueParams
): Promise<GitHubIssueComment[]> {
  const { octokit } = context;
  const comments: GitHubIssueComment[] = await octokit.paginate(
    octokit.rest.issues.listComments.endpoint.merge(issueParams)
  );
  await getMinimizedCommentStatus(context, comments);
  return comments;
}

export async function getPullRequestReviews(
  context: ContextPlugin,
  pullParams: PullParams
): Promise<GitHubPullRequestReviewState[]> {
  const { octokit } = context;
  return await octokit.paginate(octokit.rest.pulls.listReviews.endpoint.merge(pullParams));
}

export async function getPullRequestReviewComments(
  context: ContextPlugin,
  pullParams: PullParams
): Promise<GitHubPullRequestReviewComment[]> {
  const { octokit } = context;
  return await octokit.paginate(octokit.rest.pulls.listReviewComments.endpoint.merge(pullParams));
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
