import { GitHubIssue } from "./github-types";

function main(gitHubIssueId: GitHubIssue["id"]) {
  const issue = getIssue(gitHubIssueId);
  const pullRequest = getLinkedPullRequest(issue);
  const users = getUsers(issue, pullRequest);

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
   * * * * isContributor?
   * * * * isRemainder?
   */
}

function getIssue(issueId: GitHubIssue["id"]) {
  // ...
}

function getLinkedPullRequest(issue: GitHubIssue) {
  // ...
}

function getUsers(issue: GitHubIssue, pullRequest: GitHubIssue) {
  // ...
}
