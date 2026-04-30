import { GitHubPullRequest, GitHubPullRequestReviewState } from "../github-types";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

type RequestedReviewer = NonNullable<GitHubPullRequest["requested_reviewers"]>[number];
type ReviewAuthorAssociation = NonNullable<GitHubPullRequestReviewState["author_association"]>;

const COLLABORATOR_REVIEW_ASSOCIATIONS: ReviewAuthorAssociation[] = ["COLLABORATOR", "MEMBER", "OWNER"];

/**
 * Well-known bot account patterns used by the UbiquityOS ecosystem.
 * These accounts perform automated actions (labeling, closing) and should
 * NOT count as human collaboration.
 */
const BOT_LOGIN_PATTERNS = ["ubiquity-os", "ubiquity-os-beta", "github-actions[bot]", "dependabot[bot]", "vercel[bot]"];

function isBotAccount(user: { login?: string; id?: number } | null | undefined): boolean {
  if (!user?.login) return false;
  const login = user.login.toLowerCase();
  return BOT_LOGIN_PATTERNS.some((pattern) => login === pattern || login.endsWith("[bot]"));
}

/**
 * Checks if the task had human collaborator involvement beyond the assignee/contributor.
 * This prevents a contributor from single-handedly generating rewards without oversight.
 *
 * A task is considered collaborative if ALL of the following are true:
 * - The issue was closed by a real human (not a bot)
 * AND at least ONE of the following:
 * 1. The closer is someone other than the issue creator
 * 2. Someone other than the creator and assignees set pricing labels (Time/Priority)
 * 3. Someone other than the creator and assignees assigned the issue
 * 4. A non-assignee approved review exists on the linked PR
 */
export function isCollaborative(data: Readonly<IssueActivity>) {
  if (!data.self?.closed_by || !data.self.user) return false;
  const issueCreator = data.self.user;
  const closedBy = data.self.closed_by;

  // Bot-closed issues do not count as collaborative
  if (isBotAccount(closedBy)) {
    return false;
  }

  // Assignee IDs to exclude from collaborator checks (besides the creator)
  const assigneeIds = new Set(
    (data.self.assignees ?? []).map((a) => a?.id).filter((id): id is number => typeof id === "number")
  );

  // If closed by someone other than the creator, that's already collaborative
  if (closedBy.id !== issueCreator.id) {
    return true;
  }

  // Check pricing labels set by a real human who is NOT the creator or an assignee
  const pricingEventsByNonAssignee = data.events.find(
    (event) =>
      event.event === "labeled" &&
      "label" in event &&
      (event.label.name.startsWith("Time: ") || event.label.name.startsWith("Priority: ")) &&
      event.actor.id !== issueCreator.id &&
      !assigneeIds.has(event.actor.id) &&
      !isBotAccount(event.actor)
  );
  if (pricingEventsByNonAssignee) return true;

  // Check if someone other than the creator and assignees assigned the issue
  const assignmentByNonAssignee = data.events.find(
    (event) =>
      event.event === "assigned" &&
      event.actor.id !== issueCreator.id &&
      !assigneeIds.has(event.actor.id) &&
      !isBotAccount(event.actor)
  );
  if (assignmentByNonAssignee) return true;

  // Check for approved reviews by a non-assignee collaborator
  return !!nonAssigneeApprovedReviews(data);
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

  const assigneeId = data.self?.assignee?.id;
  if (!assigneeId || !linkedPullRequest.self) {
    return false;
  }

  return hasIssueContextApprovedReview(linkedPullRequest.self, linkedPullRequest.reviews, assigneeId);
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
      !excludedUserIds.has(String(review.user?.id)) &&
      review.state === "APPROVED" &&
      isReviewByCollaborator(review)
  );
}

function hasIssueContextApprovedReview(
  pullRequest: GitHubPullRequest,
  reviews: GitHubPullRequestReviewState[] | null | undefined,
  assigneeId: number
) {
  if (!reviews) {
    return false;
  }

  return reviews.some(
    (review) =>
      Boolean(review.user?.id) &&
      review.user?.id !== assigneeId &&
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
