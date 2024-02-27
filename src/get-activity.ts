import collectLinkedPulls from "./data-collection/collect-linked-pulls";
import { GitHubPullRequest, GitHubPullRequestComment, GitHubPullRequestReview } from "./github-types";
import {
  IssueParams,
  PullParams,
  getIssue,
  getIssueComments,
  getIssueEvents,
  getPullRequest,
  getPullRequestReviewComments,
  getPullRequestReviews,
} from "./start";

export class GetActivity {
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
  reviews: GitHubPullRequestReview[];
  reviewComments: GitHubPullRequestComment[];
  constructor(pullParams: PullParams) {
    this.self = getPullRequest(pullParams).catch(console.error);
    this.reviews = getPullRequestReviews(pullParams).catch(console.error);
    this.reviewComments = getPullRequestReviewComments(pullParams).catch(console.error);
  }
}
