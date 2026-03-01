/**
 * Fix: Exclude bot accounts from collaboration checks
 * 
 * Issue: https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/455
 * 
 * Problem: Bot accounts (github-actions[bot], dependabot[bot], etc.) were being
 * counted as human collaborators, allowing reward generation without human oversight.
 * 
 * Solution: Add isBot() check and exclude bot participation from collaboration logic.
 */

import { GitHubPullRequest, GitHubPullRequestReviewState } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

/**
 * Check if a user is a bot account
 * GitHub bot accounts have type "Bot" or login ending with "[bot]"
 */
export function isBot(user: { login: string; type?: string } | null | undefined): boolean {
  if (!user) return false;
  return user.type === "Bot" || user.login.endsWith("[bot]");
}

export function isCollaborative(data: Readonly<IssueActivity>) {
  if (!data.self?.closed_by || !data.self.user) return false;
  const issueCreator = data.self.user;

  // If issue was closed by a bot (not admin), it's not collaborative
  if (isBot(data.self.closed_by)) {
    // Unless there's human approval via PR review
    return !!nonAssigneeApprovedReviews(data);
  }

  if (data.self.closed_by.id === issueCreator.id) {
    // Find pricing events by non-assignee humans (exclude bots)
    const pricingEventsByNonAssignee = data.events.find(
      (event) =>
        event.event === "labeled" &&
        "label" in event &&
        (event.label.name.startsWith("Time: ") || event.label.name.startsWith("Priority: ")) &&
        event.actor.id !== issueCreator.id &&
        !isBot(event.actor)
    );
    return !!pricingEventsByNonAssignee || !!nonAssigneeApprovedReviews(data);
  }
  return true;
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
        // Skip bot reviews - they don't count as human collaboration
        if (isBot(review.user)) {
          continue;
        }
        
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
