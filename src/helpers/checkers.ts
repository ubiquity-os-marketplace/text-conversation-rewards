import { GitHubPullRequest, GitHubPullRequestReviewState } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

/**
 * Checks if the task had human collaborator involvement beyond the assignee/contributor.
 * This prevents a contributor from single-handedly generating rewards without oversight.
 *
 * A task is considered collaborative if ANY of the following is true:
 * 1. The issue was closed by someone other than the issue creator
 * 2. Someone other than the assignee(s) set pricing labels (Time/Priority)
 * 3. Someone other than the assignee(s) assigned the issue
 * 4. A non-assignee approved review exists on the linked PR
 */
export function isCollaborative(data: Readonly<IssueActivity>) {
  if (!data.self?.closed_by || !data.self.user) return false;
  const issueCreator = data.self.user;

  // Assignee IDs to exclude from collaborator checks
  const assigneeIds = (data.self.assignees ?? [])
    .map((a) => a?.id)
    .filter((id): id is number => typeof id === "number");

  if (data.self.closed_by.id !== issueCreator.id) {
    // Closed by someone other than the creator — already collaborative
    return true;
  }

  // Check pricing labels set by someone who is NOT an assignee
  const pricingEventsByNonAssignee = data.events.find(
    (event) =>
      event.event === "labeled" &&
      "label" in event &&
      (event.label.name.startsWith("Time: ") || event.label.name.startsWith("Priority: ")) &&
      event.actor.id !== issueCreator.id &&
      !assigneeIds.includes(event.actor.id)
  );
  if (pricingEventsByNonAssignee) return true;

  // Check if someone other than the assignee(s) assigned the issue
  const assignmentByNonAssignee = data.events.find(
    (event) =>
      event.event === "assigned" &&
      event.actor.id !== issueCreator.id &&
      !assigneeIds.includes(event.actor.id)
  );
  if (assignmentByNonAssignee) return true;

  // Check for approved reviews by non-assignee
  return !!nonAssigneeApprovedReviews(data);
}

export function nonAssigneeApprovedReviews(data: Readonly<IssueActivity>) {
  if (data.linkedMergedPullRequests[0] && data.self?.assignee) {
    const pullRequest = data.linkedMergedPullRequests[0].self;
    const pullReview = data.linkedMergedPullRequests[0];
    const reviewsByNonAssignee: GitHubPullRequestReviewState[] = [];
    const assignee = data.self.assignee;
    type RequestedReviewer = NonNullable<GitHubPullRequest["requested_reviewers"]>[number];

    if (pullReview.reviews && pullRequest) {
      for (const review of pullReview.reviews) {
        const isReviewRequestedForUser =
          "requested_reviewers" in pullRequest &&
          pullRequest.requested_reviewers?.some((reviewer: RequestedReviewer) => reviewer.id === review.user?.id);
        if (!isReviewRequestedForUser && review.user?.id) {
          reviewsByNonAssignee.push(review);
        }
      }
    }
    return reviewsByNonAssignee.filter((v) => v.user?.id !== assignee.id && v.state === "APPROVED");
  }
  return false;
}

/*
 * Returns true if a given user has admin permission in the specific repo, otherwise checks for admin / billing manager
 * within the parent organization.
 */
export async function isAdmin(username: string, context: ContextPlugin): Promise<boolean> {
  const octokit = context.octokit;
  try {
    const permissionLevel = await octokit.rest.repos.getCollaboratorPermissionLevel({
      username,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    context.logger.debug(`Retrieved collaborator permission level for ${username}.`, {
      username,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      isAdmin: permissionLevel.data.user?.permissions?.admin,
    });
    if (permissionLevel.data.user?.permissions?.admin) {
      return true;
    }
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
