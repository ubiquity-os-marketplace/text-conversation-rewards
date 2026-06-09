import { GitHubPullRequest, GitHubPullRequestReviewState } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

type RequestedReviewer = NonNullable<GitHubPullRequest["requested_reviewers"]>[number];
type ReviewAuthorAssociation = NonNullable<GitHubPullRequestReviewState["author_association"]>;

const COLLABORATOR_REVIEW_ASSOCIATIONS: ReviewAuthorAssociation[] = ["COLLABORATOR", "MEMBER", "OWNER"];

export function isCollaborative(data: Readonly<IssueActivity>) {
  if (!data.self?.closed_by || !data.self.user) return false;
  const rewardedUserIds = getRewardedUserIds(data);
  if (!rewardedUserIds.size) return false;

  return (
    hasSpecificationByDifferentHuman(data, rewardedUserIds) ||
    hasAssignmentByDifferentHuman(data, rewardedUserIds) ||
    nonAssigneeApprovedReviews(data)
  );
}

export function nonAssigneeApprovedReviews(data: Readonly<IssueActivity>) {
  const linkedPullRequest = data.linkedMergedPullRequests[0];
  if (!linkedPullRequest) {
    return false;
  }

  if (data.self?.pull_request) {
    const pullRequestAuthorId = linkedPullRequest.self?.user?.id ?? data.self.user?.id;
    const excludedAuthorIds = new Set(
      [pullRequestAuthorId, ...data.linkedIssues.map((issue) => issue.node.author?.id)].filter(Boolean).map(String)
    );
    return hasApprovedReviewByCollaborator(linkedPullRequest.reviews, excludedAuthorIds);
  }

  const assigneeIds = getIssueAssigneeIds(data);
  if (!assigneeIds.size || !linkedPullRequest.self) {
    return false;
  }

  return hasIssueContextApprovedReview(linkedPullRequest.self, linkedPullRequest.reviews, assigneeIds);
}

function getRewardedUserIds(data: Readonly<IssueActivity>) {
  const userIds = getIssueAssigneeIds(data);

  if (data.self?.pull_request) {
    addUserId(userIds, data.self.user);
    for (const linkedPullRequest of data.linkedMergedPullRequests) {
      addUserId(userIds, linkedPullRequest.self?.user);
    }
  }

  return userIds;
}

function getIssueAssigneeIds(data: Readonly<IssueActivity>) {
  const userIds = new Set<string>();

  for (const assignee of data.self?.assignees ?? []) {
    addUserId(userIds, assignee);
  }
  addUserId(userIds, data.self?.assignee);

  return userIds;
}

function hasSpecificationByDifferentHuman(data: Readonly<IssueActivity>, excludedUserIds: Set<string>) {
  if (data.self?.pull_request) {
    return false;
  }
  return isDifferentHuman(data.self?.user, excludedUserIds);
}

function hasAssignmentByDifferentHuman(data: Readonly<IssueActivity>, excludedUserIds: Set<string>) {
  return data.events.some((event) => {
    if (event.event !== "assigned") {
      return false;
    }

    if ("assignee" in event && event.assignee?.id && !excludedUserIds.has(String(event.assignee.id))) {
      return false;
    }

    const assigner = "assigner" in event && event.assigner ? event.assigner : event.actor;
    return isDifferentHuman(assigner, excludedUserIds);
  });
}

function addUserId(userIds: Set<string>, user: { id?: number | null } | null | undefined) {
  if (user?.id) {
    userIds.add(String(user.id));
  }
}

function isDifferentHuman(
  user: { id?: number | null; type?: string | null } | null | undefined,
  excludedUserIds: Set<string>
) {
  return Boolean(user?.id && user.type !== "Bot" && !excludedUserIds.has(String(user.id)));
}

function hasApprovedReviewByCollaborator(
  reviews: GitHubPullRequestReviewState[] | null | undefined,
  excludedUserIds: Set<string>
) {
  if (!reviews) {
    return false;
  }

  return reviews.some(
    (review) =>
      Boolean(review.user?.id) &&
      review.user?.type !== "Bot" &&
      !excludedUserIds.has(String(review.user?.id)) &&
      review.state === "APPROVED" &&
      isReviewByCollaborator(review)
  );
}

function hasIssueContextApprovedReview(
  pullRequest: GitHubPullRequest,
  reviews: GitHubPullRequestReviewState[] | null | undefined,
  excludedUserIds: Set<string>
) {
  if (!reviews) {
    return false;
  }

  return reviews.some(
    (review) =>
      Boolean(review.user?.id) &&
      review.user?.type !== "Bot" &&
      !excludedUserIds.has(String(review.user?.id)) &&
      review.state === "APPROVED" &&
      !isReviewRequestedForUser(pullRequest, review)
  );
}

function isReviewRequestedForUser(pullRequest: GitHubPullRequest, review: GitHubPullRequestReviewState) {
  if (!("requested_reviewers" in pullRequest)) {
    return false;
  }

  return (
    pullRequest.requested_reviewers?.some((reviewer: RequestedReviewer) => reviewer.id === review.user?.id) ?? false
  );
}

function isReviewByCollaborator(review: GitHubPullRequestReviewState) {
  return COLLABORATOR_REVIEW_ASSOCIATIONS.includes(review.author_association as ReviewAuthorAssociation);
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
