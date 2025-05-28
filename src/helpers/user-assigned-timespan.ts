import { IssueActivity } from "../issue-activity";
import { IssueParams } from "../start";
import { ContextPlugin } from "../types/plugin-input";

export interface AssignmentPeriod {
  assignedAt: string;
  unassignedAt: string | null;
}

export interface UserAssignments {
  [username: string]: AssignmentPeriod[];
}

/*
 * Returns the list of assignment periods per user for a given issue.
 */
export async function getAssignmentPeriods(octokit: ContextPlugin["octokit"], issueParams: IssueParams) {
  const events = await octokit.paginate(octokit.rest.issues.listEvents, {
    ...issueParams,
    per_page: 100,
  });

  const userAssignments: UserAssignments = {};

  events
    .filter((event) => ["assigned", "unassigned"].includes(event.event))
    .forEach((event) => {
      const username = "assignee" in event ? event.assignee?.login : null;
      if (!username) return;

      if (!userAssignments[username]) {
        userAssignments[username] = [];
      }

      const lastPeriod = userAssignments[username][userAssignments[username].length - 1];

      if (event.event === "assigned") {
        userAssignments[username].push({
          assignedAt: event.created_at,
          unassignedAt: null,
        });
      } else if (event.event === "unassigned" && lastPeriod && lastPeriod.unassignedAt === null) {
        lastPeriod.unassignedAt = event.created_at;
      }
    });

  Object.values(userAssignments).forEach((periods) => {
    const lastPeriod = periods[periods.length - 1];
    if (lastPeriod && lastPeriod.unassignedAt === null) {
      lastPeriod.unassignedAt = new Date().toISOString();
    }
  });

  return userAssignments;
}

export function isCommentDuringAssignment(
  comment: Awaited<ReturnType<IssueActivity["getAllComments"]>>[0],
  assignments: AssignmentPeriod[],
  isExact: boolean
) {
  const commentDate = new Date(comment.created_at);
  if (!assignments?.length) {
    return false;
  }
  if (!isExact) {
    const assignedAt = new Date(assignments[0].assignedAt);
    const lastAssignment = assignments[assignments.length - 1].unassignedAt;
    const unassignedAt = lastAssignment ? new Date(lastAssignment) : new Date();
    return commentDate >= assignedAt && commentDate <= unassignedAt;
  }
  return assignments.some((period) => {
    const assignedAt = new Date(period.assignedAt);
    const unassignedAt = period.unassignedAt ? new Date(period.unassignedAt) : new Date();
    return commentDate >= assignedAt && commentDate <= unassignedAt;
  });
}
