import { GitHubPullRequestReviewState } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

export function isCollaborative(data: Readonly<IssueActivity>) {
  if (!data.self?.closed_by || !data.self.user) return false;
  const issueCreator = data.self.user;

  if (data.self.closed_by.id === issueCreator.id) {
    const pricingEventsByNonAssignee = data.events.find(
      (event) =>
        event.event === "labeled" &&
        "label" in event &&
        (event.label.name.startsWith("Time: ") || event.label.name.startsWith("Priority: ")) &&
        event.actor.id !== issueCreator.id
    );
    return !!pricingEventsByNonAssignee || !!nonAssigneeApprovedReviews(data);
  }
  return true;
}

export function nonAssigneeApprovedReviews(data: Readonly<IssueActivity>) {
  if (data.linkedReviews[0] && data.self?.assignee) {
    const pullRequest = data.linkedReviews[0].self;
    const pullReview = data.linkedReviews[0];
    const reviewsByNonAssignee: GitHubPullRequestReviewState[] = [];
    const assignee = data.self.assignee;

    if (pullReview.reviews && pullRequest) {
      for (const review of pullReview.reviews) {
        const isReviewRequestedForUser =
          "requested_reviewers" in pullRequest &&
          pullRequest.requested_reviewers?.some((o) => o.id === review.user?.id);
        if (!isReviewRequestedForUser && review.user?.id) {
          reviewsByNonAssignee.push(review);
        }
      }
    }
    return reviewsByNonAssignee.filter((v) => v.user?.id !== assignee.id && v.state === "APPROVED");
  }
  return false;
}

export async function isAdmin(username: string, context: ContextPlugin): Promise<boolean> {
  const octokit = context.octokit;
  try {
    const userPerms = await octokit.rest.orgs.getMembershipForUser({
      org: context.payload.repository.owner.login,
      username: username,
    });
    return userPerms.data.role === "admin" || userPerms.data.role === "billing_manager";
  } catch (e) {
    context.logger.debug(`${username} is not a member of ${context.payload.repository.owner.login}`, { e });
    return false;
  }
}
