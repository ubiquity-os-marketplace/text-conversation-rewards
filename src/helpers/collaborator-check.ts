import { ContextPlugin } from "../types/plugin-input";
import { getUserRewardRole, RewardUserRole } from "./permissions";

/**
 * Checks if a human collaborator (non-admin) was involved in the issue/PR workflow.
 * 
 * This prevents reward generation when only admins/bots are involved,
 * ensuring proper peer review and collaboration.
 * 
 * @param context - The plugin context
 * @returns true if a human collaborator was involved, false otherwise
 */
export async function hasHumanCollaboratorInvolvement(context: ContextPlugin): Promise<boolean> {
  const { octokit, payload, logger } = context;
  const issue = "issue" in payload ? payload.issue : payload.pull_request;
  
  if (!issue) {
    logger.debug("No issue found in payload, skipping collaborator check.");
    return false;
  }

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueNumber = issue.number;

  try {
    // Check 1: Look for non-admin collaborators in issue comments
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const senderLogin = payload.sender.login;
    
    for (const comment of comments) {
      const commentAuthor = comment.user?.login;
      if (!commentAuthor || commentAuthor === senderLogin) {
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
      if (!assignee.login || assignee.login === senderLogin) {
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
      const { data: reviews } = await octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: issueNumber,
      });

      for (const review of reviews) {
        const reviewer = review.user?.login;
        if (!reviewer || reviewer === senderLogin) {
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
    const { data: issueEvents } = await octokit.rest.issues.listEvents({
      owner,
      repo,
      issue_number: issueNumber,
    });

    const referencedByPull = issueEvents.find(event => 
      event.event === "referenced" && 
      event.source?.issue?.pull_request
    );

    if (referencedByPull) {
      // Extract PR number from the event
      const pullRequestEvent = issueEvents.find(e => e.event === "referenced" && e.source?.issue?.pull_request);
      if (pullRequestEvent && pullRequestEvent.source?.issue) {
        const prNumber = pullRequestEvent.source.issue.number;
        
        try {
          const { data: pr } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
          });

          const prAuthor = pr.user?.login;
          if (prAuthor && prAuthor !== senderLogin && pr.user?.type !== "Bot") {
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
    }

    logger.debug(`No human collaborator involvement found for issue #${issueNumber}`);
    return false;

  } catch (error) {
    logger.warn(`Error checking human collaborator involvement: ${(error as Error).message}`);
    // Fail open - don't block rewards if check fails
    return true;
  }
}
