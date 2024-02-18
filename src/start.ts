import { getOctokitInstance } from "./get-authentication-token";
import { GitHubIssue } from "./github-types";

async function main(gitHubIssueUrl: GitHubIssue["html_url"]) {
  const issueParams = parseGitHubUrl(gitHubIssueUrl);
  const issue = await getIssue(issueParams);
  const pullRequest = getLinkedPullRequest(issue);
  const users = getUsers(issue, pullRequest);

  const usersByType = {
    assignees: users.filter((user) => user.isAssignee),
    authors: users.filter((user) => user.isAuthor),
    collaborators: users.filter((user) => user.isCollaborator),
    remainder: users.filter((user) => user.isRemainder),
  };

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
}

async function getIssue(params: IssueParams): Promise<GitHubIssue> {
  const octokit = getOctokitInstance();
  return (await octokit.issues.get(params)).data;
}

function getLinkedPullRequest(issue: GitHubIssue) {
  // this needs to see all of the events that happened on the issue and filter for "connected" or "cross-referenced" events


}

function getUsers(issue: GitHubIssue, pullRequest: null | GitHubIssue) {
  // ...
}

export function parseGitHubUrl(url: string): { owner: string; repo: string; issue_number: number } {
  const path = new URL(url).pathname.split("/");
  return {
    owner: path[1],
    repo: path[2],
    issue_number: Number(path[4]),
  };
}

export type IssueParams = ReturnType<typeof parseGitHubUrl>;
