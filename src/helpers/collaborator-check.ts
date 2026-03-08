import { ContextPlugin } from "../types/plugin-input";
import { getUserRewardRole } from "./permissions";

/**
 * Checks if a user is an eligible human collaborator (non-admin, non-bot).
 */
async function isEligibleCollaborator(
  context: ContextPlugin,
  login: string | undefined,
  userType: string | undefined,
  excludeLogins: Set<string>
): Promise<boolean> {
  if (!login || excludeLogins.has(login) || userType === "Bot") {
    return false;
  }
  const role = await getUserRewardRole(context, login);
  return role === "collaborator" || role === "contributor";
}

/**
 * Check for eligible collaborator in issue comments.
 */
async function checkIssueComments(
  context: ContextPlugin,
  owner: string,
  repo: string,
  issueNumber: number,
  excludeLogins: Set<string>
): Promise<string | null> {
  const comments = await context.octokit.paginate(context.octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  for (const comment of comments) {
    if (await isEligibleCollaborator(context, comment.user?.login, comment.user?.type, excludeLogins)) {
      return comment.user!.login;
    }
  }
  return null;
}

/**
 * Check for eligible collaborator in issue assignees.
 */
async function checkAssignees(
  context: ContextPlugin,
  issue: { assignees?: Array<{ login?: string; type?: string }> },
  excludeLogins: Set<string>
): Promise<string | null> {
  const assignees = issue.assignees ?? [];
  for (const assignee of assignees) {
    if (await isEligibleCollaborator(context, assignee.login, assignee.type, excludeLogins)) {
      return assignee.login!;
    }
  }
  return null;
}

/**
 * Check for eligible collaborator in PR reviews.
 */
async function checkPrReviews(
  context: ContextPlugin,
  owner: string,
  repo: string,
  issueNumber: number,
  excludeLogins: Set<string>
): Promise<string | null> {
  const reviews = await context.octokit.paginate(context.octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: issueNumber,
    per_page: 100,
  });

  for (const review of reviews) {
    if (await isEligibleCollaborator(context, review.user?.login, review.user?.type, excludeLogins)) {
      return review.user!.login;
    }
  }
  return null;
}

/**
 * Check for eligible collaborator in linked PRs.
 */
async function checkLinkedPrs(
  context: ContextPlugin,
  owner: string,
  repo: string,
  issueNumber: number,
  excludeLogins: Set<string>
): Promise<string | null> {
  const events = await context.octokit.paginate(context.octokit.rest.issues.listEvents, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const referencedPrEvents = events.filter(
    (event) => event.event === "referenced" && event.source?.issue?.pull_request
  );

  for (const prEvent of referencedPrEvents) {
    if (!prEvent.source?.issue) {
      continue;
    }

    const prNumber = prEvent.source.issue.number;

    try {
      const pr = await context.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      if (await isEligibleCollaborator(context, pr.data.user?.login, pr.data.user?.type, excludeLogins)) {
        return pr.data.user!.login;
      }
    } catch (e) {
      context.logger.debug(`Failed to get PR #${prNumber} details`, { e });
    }
  }
  return null;
}

/**
 * Checks if a human collaborator (non-admin) was involved in the issue/PR workflow.
 *
 * This prevents reward generation when only admins/bots are involved,
 * ensuring proper peer review and collaboration.
 *
 * @param context - The plugin context
 * @param rewardRecipients - Array of logins who will receive rewards (to exclude from check)
 * @returns true if a human collaborator was involved, false otherwise
 */
export async function hasHumanCollaboratorInvolvement(
  context: ContextPlugin,
  rewardRecipients?: string[]
): Promise<boolean> {
  const { payload, logger } = context;
  const issue = "issue" in payload ? payload.issue : payload.pull_request;

  if (!issue) {
    logger.debug("No issue found in payload, skipping collaborator check.");
    return false;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueNumber = issue.number;

  // Build list of users to exclude (sender + reward recipients)
  const excludeLogins = new Set<string>([payload.sender.login]);
  if (rewardRecipients) {
    rewardRecipients.forEach((login) => excludeLogins.add(login));
  }

  try {
    // Check all four sources for eligible collaborator
    const collaborator =
      (await checkIssueComments(context, owner, repo, issueNumber, excludeLogins)) ||
      (await checkAssignees(context, issue, excludeLogins)) ||
      (await checkPrReviews(context, owner, repo, issueNumber, excludeLogins)) ||
      (await checkLinkedPrs(context, owner, repo, issueNumber, excludeLogins));

    if (collaborator) {
      logger.info(`Found human collaborator involvement: ${collaborator}`);
      return true;
    }

    logger.debug(`No human collaborator involvement found for issue #${issueNumber}`);
    return false;
  } catch (error) {
    logger.warn(`Error checking human collaborator involvement: ${(error as Error).message}`);
    // Fail closed - block rewards if check fails
    return false;
  }
}
