import { describe, expect, it } from "@jest/globals";
import { isCollaborative, nonAssigneeApprovedReviews } from "../../src/helpers/checkers";
import { IssueActivity } from "../../src/issue-activity";

type PartialIssueActivity = Partial<IssueActivity> & {
  self?: Record<string, unknown>;
  events?: Array<Record<string, unknown>>;
  linkedMergedPullRequests?: Array<Record<string, unknown>>;
};

function buildActivity(overrides: PartialIssueActivity = {}) {
  const base: PartialIssueActivity = {
    self: {
      closed_by: { id: 1 },
      user: { id: 1 },
      assignee: { id: 1 },
      assignees: [{ id: 1 }],
    },
    events: [],
    linkedMergedPullRequests: [],
  };

  return {
    ...base,
    ...overrides,
    self: {
      ...base.self,
      ...(overrides.self ?? {}),
    },
  } as IssueActivity;
}

describe("isCollaborative", () => {
  it("returns false when only a bot changed pricing labels", () => {
    const activity = buildActivity({
      events: [
        {
          event: "labeled",
          label: { name: "Priority: 2 (Medium)" },
          actor: { id: 999, type: "Bot" },
        },
      ],
    });

    expect(isCollaborative(activity)).toBe(false);
  });

  it("returns true when a different human changed pricing labels", () => {
    const activity = buildActivity({
      events: [
        {
          event: "labeled",
          label: { name: "Time: <1 Hour" },
          actor: { id: 2, type: "User" },
        },
      ],
    });

    expect(isCollaborative(activity)).toBe(true);
  });

  it("does not treat empty non-assignee review matches as collaborative", () => {
    const activity = buildActivity({
      linkedMergedPullRequests: [
        {
          self: { requested_reviewers: [] },
          reviews: [
            {
              state: "COMMENTED",
              user: { id: 2, type: "User" },
            },
          ],
        },
      ],
    });

    expect(nonAssigneeApprovedReviews(activity)).toBe(false);
    expect(isCollaborative(activity)).toBe(false);
  });

  it("returns true when a non-assignee human approved a linked pull", () => {
    const activity = buildActivity({
      linkedMergedPullRequests: [
        {
          self: { requested_reviewers: [] },
          reviews: [
            {
              state: "APPROVED",
              user: { id: 2, type: "User" },
            },
          ],
        },
      ],
    });

    expect(nonAssigneeApprovedReviews(activity)).toBe(true);
    expect(isCollaborative(activity)).toBe(true);
  });

  it("returns true when closer is not issue creator", () => {
    const activity = buildActivity({
      self: {
        closed_by: { id: 2 },
        user: { id: 1 },
      },
    });

    expect(isCollaborative(activity)).toBe(true);
  });
});
