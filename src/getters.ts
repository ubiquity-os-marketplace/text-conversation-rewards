import collectLinkedPulls from "./data-collection/collect-linked-pulls";
import { GitHubComment, GitHubPullRequest } from "./github-types";
import { IssueParams, getIssue, getIssueComments, getIssueEvents, getPullRequest, getPullRequestComments, getPullRequestReviewComments } from "./start";

export class GetIssue {
  self: null;
  events: null;
  comments: null;
  linkedReviews: [];
  constructor(issueParams: IssueParams) {
    this.self = getIssue(issueParams).catch(console.error);
    this.events = getIssueEvents(issueParams).catch(console.error);
    this.comments = getIssueComments(issueParams).catch(console.error);
    this.linkedReviews = collectLinkedPulls(issueParams)
      .then(async (pulls) => {
        const promises = pulls.map((pull) => {
          const pullParams = {
            owner: pull.source.issue.repository.owner.login,
            repo: pull.source.issue.repository.name,
            pull_number: pull.source.issue.number,
          };
          return new Review(pullParams);
        });
        this.linkedReviews = await Promise.all(promises).catch(console.error);
      })
      .catch(console.error);
  }
}

class Review {
  self: GitHubPullRequest;
  comments: GitHubComment[];
  reviewComments: [];
  constructor(pullParams: pullParams) {
    self = getPullRequest(pullParams).catch(console.error);
    comments = getPullRequestComments(pullParams).catch(console.error);
    reviewComments = getPullRequestReviewComments(pullParams).catch(console.error);
  }
}
