import { Static, Type } from "@sinclair/typebox";

/**
 * Contributor roles that can be targeted for rewards.
 */
export const ContributorRole = Type.Union([
  Type.Literal("ISSUER"),
  Type.Literal("ASSIGNEE"),
  Type.Literal("COLLABORATOR"),
  Type.Literal("CONTRIBUTOR"),
]);

export type ContributorRoleType = Static<typeof ContributorRole>;

/**
 * Event target configuration specifying which roles receive rewards
 * and the reward value for a specific context (issue or pull).
 */
const eventTargetType = Type.Object(
  {
    targets: Type.Array(ContributorRole, {
      description: "Contributor roles eligible for this reward",
    }),
    value: Type.Number({
      default: 0,
      description: "Reward value per occurrence of this event",
    }),
  },
  { additionalProperties: false }
);

/**
 * Event configuration with separate issue and pull contexts.
 */
const eventContextType = Type.Object(
  {
    pull: Type.Optional(eventTargetType),
    issue: Type.Optional(eventTargetType),
  },
  { additionalProperties: false }
);

/**
 * Simplified event configuration with a single target/value pair
 * (used for events without issue/pull distinction like push).
 */
const simpleEventTargetType = Type.Object(
  {
    targets: Type.Array(ContributorRole, {
      description: "Contributor roles eligible for this reward",
    }),
    value: Type.Number({
      default: 0,
      description: "Reward value per occurrence of this event",
    }),
  },
  { additionalProperties: false }
);

/**
 * Build event action names from a list of actions.
 * Creates a TypeBox object where each key is an action name and value is eventContextType.
 */
function buildEventActions(actions: string[]) {
  const properties: Record<string, ReturnType<typeof Type.Optional>> = {};
  for (const action of actions) {
    properties[action] = Type.Optional(eventContextType);
  }
  return Type.Object(properties, { additionalProperties: false });
}

// pull_request actions
const pullRequestActions = buildEventActions([
  "assigned",
  "auto_merge_disabled",
  "auto_merge_enabled",
  "closed",
  "converted_to_draft",
  "demilestoned",
  "dequeued",
  "edited",
  "enqueued",
  "labeled",
  "locked",
  "milestoned",
  "opened",
  "ready_for_review",
  "reopened",
  "review_request_removed",
  "review_requested",
  "synchronize",
  "unassigned",
  "unlabeled",
  "unlocked",
]);

// pull_request_review actions
const pullRequestReviewActions = buildEventActions(["dismissed", "edited", "submitted"]);

// pull_request_review_comment actions
const pullRequestReviewCommentActions = buildEventActions(["created", "deleted", "edited"]);

// pull_request_review_thread actions
const pullRequestReviewThreadActions = buildEventActions(["resolved", "unresolved"]);

// issue_comment actions
const issueCommentActions = buildEventActions(["created", "deleted", "edited"]);

// commit_comment actions
const commitCommentActions = buildEventActions(["created"]);

// workflow_run actions
const workflowRunActions = buildEventActions(["completed", "in_progress", "requested"]);

// check_run actions
const checkRunActions = buildEventActions(["completed", "created", "requested_action", "rerequested"]);

// check_suite actions
const checkSuiteActions = buildEventActions(["completed", "requested", "rerequested"]);

export const eventIncentivesConfigurationType = Type.Object(
  {
    pull_request: Type.Optional(pullRequestActions),
    pull_request_review: Type.Optional(pullRequestReviewActions),
    pull_request_review_comment: Type.Optional(pullRequestReviewCommentActions),
    pull_request_review_thread: Type.Optional(pullRequestReviewThreadActions),
    issue_comment: Type.Optional(issueCommentActions),
    commit_comment: Type.Optional(commitCommentActions),
    push: Type.Optional(simpleEventTargetType),
    workflow_run: Type.Optional(workflowRunActions),
    workflow_dispatch: Type.Optional(simpleEventTargetType),
    check_run: Type.Optional(checkRunActions),
    check_suite: Type.Optional(checkSuiteActions),
    /**
     * Map internal event keys (as counted by EventIncentivesModule) to reward values.
     * This provides a simpler alternative to the full webhook-based config above.
     * Keys are event names like "issue.labeled", "pull_request.commented", etc.
     * Values are objects with "targets" and "value".
     */
    events: Type.Optional(
      Type.Record(
        Type.String({ description: "Event key as counted by the module, e.g. 'issue.labeled'" }),
        Type.Object(
          {
            targets: Type.Array(ContributorRole, { description: "Contributor roles eligible for this reward" }),
            value: Type.Number({ default: 0, description: "Reward value per occurrence" }),
          },
          { additionalProperties: false }
        )
      )
    ),
  },
  {
    additionalProperties: false,
    default: {},
  }
);

export type EventIncentivesConfiguration = Static<typeof eventIncentivesConfigurationType>;
