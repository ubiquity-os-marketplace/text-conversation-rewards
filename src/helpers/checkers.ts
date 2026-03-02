import { GitHubPullRequest } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

export function isCollaborative(data: Readonly<IssueActivity>) {
  if (!data.self?.closed_by || !data.self.user) return false;
  const issueCreator = data.self.user;

  if (data.self.closed_by.id === issueCreator.id) {
    const pricingEventsByDifferentHuman = data.events.find(
      (event) =>
        event.event === "labeled" &&
        "label" in event &&
        (event.label.name.startsWith("Time: ") || event.label.name.startsWith("Priority: ")) &&
        event.actor.id !== issueCreator.id &&
        event.actor.type === "User"
    );
    return !!pricingEventsByDifferentHuman || nonAssigneeApprovedReviews(data);
  }
  return true;
}

export function nonAssigneeApprovedReviews(data: Readonly<IssueActivity>) {
  if (!data.linkedMergedPullRequests[0]) {
    return false;
  }

  const pullRequest = data.linkedMergedPullRequests[0].self;
  const pullReview = data.linkedMergedPullRequests[0];
  type RequestedReviewer = NonNullable<GitHubPullRequest["requested_reviewers"]>[number];

  const assigneeIds = new Set<number>([
    ...(data.self?.assignees?.map((assignee) => assignee.id) ?? []),
    ...(data.self?.assignee?.id ? [data.self.assignee.id] : []),
  ]);

  if (!pullReview.reviews || !pullRequest) {
    return false;
  }

  for (const review of pullReview.reviews) {
    const isReviewRequestedForUser =
      "requested_reviewers" in pullRequest &&
      pullRequest.requested_reviewers?.some((reviewer: RequestedReviewer) => reviewer.id === review.user?.id);

    if (isReviewRequestedForUser || !review.user?.id || review.user.type !== "User") {
      continue;
    }

    if (review.state === "APPROVED" && !assigneeIds.has(review.user.id)) {
      return true;
    }
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
