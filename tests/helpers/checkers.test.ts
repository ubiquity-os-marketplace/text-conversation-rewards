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

describe("checkers collaboration gating", () => {
  it("does not count bot-applied pricing labels as human collaboration", () => {
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

  it("counts approved reviews from a different human as collaborative", () => {
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
});
