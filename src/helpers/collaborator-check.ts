import { ContextPlugin } from "../types/plugin-input";
import { getUserRewardRole } from "./permissions";

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
  const { octokit, payload, logger } = context;
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
    rewardRecipients.forEach(login => excludeLogins.add(login));
  }

  try {
    // Check 1: Look for non-admin collaborators in issue comments
    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    for (const comment of comments) {
      const commentAuthor = comment.user?.login;
      if (!commentAuthor || excludeLogins.has(commentAuthor)) {
        continue;
      }

      // Skip bots
      if (comment.user?.type === "Bot") {
        continue;
      }

      // Check if this user is a collaborator (not admin)
      const role = await getUserRewardRole(context, commentAuthor);
      if (role === "collaborator" || role === "contributor") {
        logger.info(`Found human collaborator involvement: ${commentAuthor} commented on issue #${issueNumber}`);
        return true;
      }
    }

    // Check 2: Look for non-admin assignees
    const assignees = issue.assignees ?? [];
    for (const assignee of assignees) {
      if (!assignee.login || excludeLogins.has(assignee.login)) {
        continue;
      }

      // Skip bots
      if (assignee.type === "Bot") {
        continue;
      }

      const role = await getUserRewardRole(context, assignee.login);
      if (role === "collaborator" || role === "contributor") {
        logger.info(`Found human collaborator involvement: ${assignee.login} is assigned to issue #${issueNumber}`);
        return true;
      }
    }

    // Check 3: Look for PR reviews from non-admin collaborators
    if ("pull_request" in payload && payload.pull_request) {
      const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
        owner,
        repo,
        pull_number: issueNumber,
        per_page: 100,
      });

      for (const review of reviews) {
        const reviewer = review.user?.login;
        if (!reviewer || excludeLogins.has(reviewer)) {
          continue;
        }

        // Skip bots
        if (review.user?.type === "Bot") {
          continue;
        }

        const role = await getUserRewardRole(context, reviewer);
        if (role === "collaborator" || role === "contributor") {
          logger.info(`Found human collaborator involvement: ${reviewer} reviewed PR #${issueNumber}`);
          return true;
        }
      }
    }

    // Check 4: Look for linked PRs authored by non-admin collaborators
    const events = await octokit.paginate(octokit.rest.issues.listEvents, {
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    // Find all referenced PR events
    const referencedPrEvents = events.filter(event => 
      event.event === "referenced" && 
      event.source?.issue?.pull_request
    );

    // Check each referenced PR
    for (const prEvent of referencedPrEvents) {
      if (!prEvent.source?.issue) {
        continue;
      }

      const prNumber = prEvent.source.issue.number;
      
      try {
        const pr = await octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: prNumber,
        });

        const prAuthor = pr.data.user?.login;
        if (prAuthor && !excludeLogins.has(prAuthor) && pr.data.user?.type !== "Bot") {
          const role = await getUserRewardRole(context, prAuthor);
          if (role === "collaborator" || role === "contributor") {
            logger.info(`Found human collaborator involvement: ${prAuthor} authored linked PR #${prNumber}`);
            return true;
          }
        }
      } catch (e) {
        logger.debug(`Failed to get PR #${prNumber} details`, { e });
      }
    }

    logger.debug(`No human collaborator involvement found for issue #${issueNumber}`);
    return false;

  } catch (error) {
    logger.warn(`Error checking human collaborator involvement: ${(error as Error).message}`);
    // Fail closed - block rewards if check fails
    return false;
  }
}
