import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";
import { getUserRewardRole } from "./permissions";

/**
 * Collects the logins of users who participated in key roles for a given issue:
 * - Spec author (issue creator)
 * - Assignees
 * - PR authors (of linked, merged PRs)
 * - Reviewers (of linked, merged PRs)
 *
 * Returns a Set of unique human logins involved in these roles.
 */
function collectParticipantLogins(activity: Readonly<IssueActivity>): {
  specAuthor: string | null;
  assignees: Set<string>;
  prAuthors: Set<string>;
  reviewers: Set<string>;
} {
  const specAuthor = activity.self?.user?.login ?? null;
  const assignees = new Set<string>((activity.self?.assignees ?? []).map((a) => a.login).filter(Boolean) as string[]);

  const prAuthors = new Set<string>();
  const reviewers = new Set<string>();

  for (const pull of activity.linkedMergedPullRequests) {
    // PR author
    if (pull.self?.user?.login && pull.self.user.type !== "Bot") {
      prAuthors.add(pull.self.user.login);
    }
    // PR reviewers
    if (pull.reviews) {
      for (const review of pull.reviews) {
        if (review.user?.login && review.user.type !== "Bot") {
          reviewers.add(review.user.login);
        }
      }
    }
  }

  return { specAuthor, assignees, prAuthors, reviewers };
}

/**
 * Collects all unique human logins that participated across key roles,
 * excluding bot accounts.
 */
function getUniqueParticipants(activity: Readonly<IssueActivity>): Set<string> {
  const { specAuthor, assignees, prAuthors, reviewers } = collectParticipantLogins(activity);
  const all = new Set<string>();
  if (specAuthor) all.add(specAuthor);
  for (const a of assignees) all.add(a);
  for (const a of prAuthors) all.add(a);
  for (const r of reviewers) all.add(r);
  return all;
}

/**
 * Validates that reward generation requires multi-role participation.
 *
 * The check ensures that more than one unique human participated in the key roles:
 * - Spec author (issue creator)
 * - Assignee(s)
 * - PR author(s) of linked merged PRs
 * - Reviewer(s) of linked merged PRs
 *
 * If only one human filled all these roles, reward generation is blocked
 * unless that user has admin privileges.
 *
 * @returns true if validation passes (rewards should be generated), false if blocked
 */
export async function validateMultiRoleParticipation(
  context: ContextPlugin,
  activity: Readonly<IssueActivity>
): Promise<{ valid: boolean; reason?: string }> {
  const uniqueParticipants = getUniqueParticipants(activity);

  // If there are multiple unique participants, validation passes
  if (uniqueParticipants.size > 1) {
    return { valid: true };
  }

  // Only one participant across all roles — check if they're admin
  const soleParticipant = [...uniqueParticipants][0];
  if (!soleParticipant) {
    return {
      valid: false,
      reason: "No human participants found in key roles (spec author, assignee, PR author, or reviewer).",
    };
  }

  // Check if the sole participant is an admin
  try {
    const role = await getUserRewardRole(context, soleParticipant);
    if (role === "admin") {
      context.logger.info(`Sole participant ${soleParticipant} is admin, allowing reward generation.`);
      return { valid: true };
    }
  } catch (e) {
    context.logger.debug(`Could not determine role for ${soleParticipant}`, { e });
  }

  return {
    valid: false,
    reason: `Reward generation blocked: only one human participant (${soleParticipant}) filled all key roles (spec author, assignee, PR author, reviewer). At least two distinct humans are required, or the sole participant must be an admin.`,
  };
}
