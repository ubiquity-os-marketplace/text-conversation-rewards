/**
 * Unit tests for helpers/checkers.ts — Issue #455
 *
 * Bug 1: nonAssigneeApprovedReviews() used to return an array.
 *   An empty array is truthy in JS, so `!![]` evaluated to `true` even when
 *   zero approvals existed, generating false-positive rewards.
 *   Fix: now returns boolean via `.length > 0`.
 *
 * Bug 2: pricingEventsByNonAssignee did not filter out bot actors.
 *   Bot-applied Time:/Priority: labels counted as human collaboration,
 *   bypassing the non-collaborative guard for single-person workflows.
 *   Fix: added `event.actor.type !== "Bot"` guard.
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
describe("nonAssigneeApprovedReviews — returns boolean (Bug #455 fix 1)", () => {
  it("returns false when there are no linked pull requests", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
  });

  it("returns false (not truthy []) when assignee self-approved and no other approvals exist", () => {
    // Before the fix: filter returned [] which !! evaluated as true → false-positive reward
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          self: { requested_reviewers: [] },
          reviews: [{ user: { id: 1 }, state: "APPROVED" }], // assignee reviewed own PR
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
  });

  it("returns false when the only review is a CHANGES_REQUESTED from a non-assignee", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          self: { requested_reviewers: [] },
          reviews: [{ user: { id: 2 }, state: "CHANGES_REQUESTED" }],
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
  });

  it("returns true when a non-assignee human approved the PR", () => {
    const activity = makeActivity({
      self: { assignee: { id: 1, login: "assignee" } },
      linkedMergedPullRequests: [
        {
          self: { requested_reviewers: [] },
          reviews: [{ user: { id: 2 }, state: "APPROVED" }], // different user approved
        },
      ],
    });
    expect(nonAssigneeApprovedReviews(activity)).toBe(true);
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
