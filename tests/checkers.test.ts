/**
 * Unit tests for helpers/checkers.ts — Issues #455 and #527
 *
 * Bug 1 (#455): nonAssigneeApprovedReviews() used to return an array.
 *   An empty array is truthy in JS, so `!![]` evaluated to `true` even when
 *   zero approvals existed, generating false-positive rewards.
 *   Fix: now uses .some() which returns a proper boolean.
 *
 * Bug 2 (#455): pricingEventsByNonAssignee did not filter out bot actors.
 *   Bot-applied Time:/Priority: labels counted as human collaboration,
 *   bypassing the non-collaborative guard for single-person workflows.
 *   Fix: added `event.actor.type !== "Bot"` guard.
 *
 * Bug 3 (#527): CHANGES_REQUESTED reviews were not counted as collaboration.
 *   A PR with many reviewers who requested changes was marked non-collaborative.
 *   Fix: CHANGES_REQUESTED now counts alongside APPROVED as collaborative evidence.
 *   Also removed: the requested_reviewers exclusion that silently discarded genuine reviews.
 */

import { describe, expect, it } from "@jest/globals";
import { isCollaborative, nonAssigneeApprovedReviews } from "../src/helpers/checkers";
import { IssueActivity } from "../src/issue-activity";

// Minimal stub factory — casts via unknown to satisfy TS without importing all GitHub types.
function makeActivity(overrides: object): Readonly<IssueActivity> {
  return {
    self: null,
    events: [],
    comments: [],
    linkedMergedPullRequests: [],
    linkedIssues: [],
    ...overrides,
  } as unknown as Readonly<IssueActivity>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Bug 1 — nonAssigneeApprovedReviews must return boolean, not array
// ──────────────────────────────────────────────────────────────────────────────
describe("nonAssigneeApprovedReviews — #455 fix + #527 regression", () => {
  it("returns false when there are no linked pull requests", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
  });

  it("returns false when assignee self-approved and no other approvals exist", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          reviews: [{ user: { id: 1 }, state: "APPROVED" }], // assignee reviewed own PR
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
  });

  it("returns true when a non-assignee APPROVED the PR (#455 original fix)", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          reviews: [{ user: { id: 2 }, state: "APPROVED" }],
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(true);
  });

  // #527 regression: CHANGES_REQUESTED was previously excluded but indicates stronger engagement
  it("returns true when a non-assignee submitted CHANGES_REQUESTED (#527 fix)", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          reviews: [{ user: { id: 2 }, state: "CHANGES_REQUESTED" }],
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(true);
  });

  // #527 regression: requested_reviewers exclusion was silently discarding genuine reviews
  it("returns true when a formally-requested non-assignee reviewer approved (#527 fix)", () => {
    // Previously: if reviewer was in requested_reviewers, review was excluded → false-negative
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          self: { requested_reviewers: [{ id: 2 }] }, // reviewer was formally requested
          reviews: [{ user: { id: 2 }, state: "APPROVED" }],
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(true);
  });

  it("returns false when the only non-assignee review has state COMMENTED (not substantive)", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          reviews: [{ user: { id: 2 }, state: "COMMENTED" }],
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Bug 2 — bot-applied labels must not count as human collaboration
// ──────────────────────────────────────────────────────────────────────────────
describe("isCollaborative — bot labels excluded (Bug #455 fix 2)", () => {
  const CREATOR_ID = 1;
  const OTHER_ID = 999;

  function makeClosedByCreatorActivity(actorType: string) {
    return makeActivity({
      self: {
        user: { id: CREATOR_ID },
        closed_by: { id: CREATOR_ID }, // creator closed own issue
        assignee: { id: CREATOR_ID, login: "creator" },
      },
      events: [
        {
          event: "labeled",
          label: { name: "Time: <4 Hours" },
          actor: { id: OTHER_ID, type: actorType },
        },
      ],
      linkedMergedPullRequests: [],
    });
  }

  it("returns false when only a bot applied the pricing label (not real human collaboration)", () => {
    // Before fix: bot-applied label fulfilled the pricingEventsByNonAssignee check → false-positive
    const activity = makeClosedByCreatorActivity("Bot");
    expect(isCollaborative(activity)).toBe(false);
  });

  it("returns true when a real human (non-creator) applied the pricing label", () => {
    const activity = makeClosedByCreatorActivity("User");
    expect(isCollaborative(activity)).toBe(true);
  });

  it("returns false when there are no events and no approved reviews", () => {
    const activity = makeActivity({
      self: {
        user: { id: CREATOR_ID },
        closed_by: { id: CREATOR_ID },
        assignee: { id: CREATOR_ID, login: "creator" },
      },
      events: [],
      linkedMergedPullRequests: [],
    });
    expect(isCollaborative(activity)).toBe(false);
  });

  it("returns true when closed_by is different from the issue creator", () => {
    const activity = makeActivity({
      self: {
        user: { id: CREATOR_ID },
        closed_by: { id: 42 }, // someone else closed it
        assignee: { id: CREATOR_ID, login: "creator" },
      },
      events: [],
      linkedMergedPullRequests: [],
    });
    expect(isCollaborative(activity)).toBe(true);
  });
});
