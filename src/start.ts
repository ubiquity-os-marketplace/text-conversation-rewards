import { GitHubIssue } from "./github-types";

function main(gitHubIssueId: GitHubIssue["id"]) {
  const issue = getIssue(gitHubIssueId);
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

function getIssue(issueId: GitHubIssue["id"]) {}

function getLinkedPullRequest(issue: GitHubIssue) {
  // ...
}

function getUsers(issue: GitHubIssue, pullRequest: GitHubIssue) {
  // ...
}
