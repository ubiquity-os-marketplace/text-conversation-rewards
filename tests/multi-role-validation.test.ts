import { describe, expect, it } from "@jest/globals";
import { IssueActivity, PullRequest } from "../src/issue-activity";
import { validateMultiRoleParticipation } from "../src/helpers/multi-role-validation";
import { ContextPlugin } from "../src/types/plugin-input";

function createMockContext(overrides: Record<string, unknown> = {}): ContextPlugin {
  return {
    payload: {
      repository: {
        owner: { login: "test-org" },
        name: "test-repo",
      },
      sender: { login: "testuser" },
      issue: {
        html_url: "https://github.com/test-org/test-repo/issues/1",
        number: 1,
      },
    },
    logger: {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    config: {
      incentives: {},
    },
    ...overrides,
  } as unknown as ContextPlugin;
}

function createMockActivity(opts: {
  specAuthor?: string;
  assignees?: string[];
  prAuthors?: string[];
  reviewers?: string[];
}): Readonly<IssueActivity> {
  const activity = {
    self: {
      user: opts.specAuthor ? { login: opts.specAuthor, type: "User" } : null,
      assignees: (opts.assignees ?? []).map((login) => ({ login })),
      html_url: "https://github.com/test-org/test-repo/issues/1",
    },
    linkedMergedPullRequests: [
      {
        self: {
          user: opts.prAuthors?.[0] ? { login: opts.prAuthors[0], type: "User" } : null,
        },
        reviews: (opts.reviewers ?? []).map((login) => ({
          user: { login, type: "User" },
        })),
      } as unknown as PullRequest,
    ],
  } as unknown as IssueActivity;
  return activity;
}

describe("validateMultiRoleParticipation", () => {
  it("should pass when multiple humans participate across roles", async () => {
    const context = createMockContext();
    const activity = createMockActivity({
      specAuthor: "alice",
      assignees: ["bob"],
      prAuthors: ["bob"],
      reviewers: ["charlie"],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(true);
  });

  it("should block when only one human fills all roles", async () => {
    const context = createMockContext();
    // Mock getUserRewardRole to return non-admin
    jest.mock("../src/helpers/permissions", () => ({
      getUserRewardRole: jest.fn(() => Promise.resolve("collaborator")),
      isAdminRole: jest.fn(() => false),
    }));

    const activity = createMockActivity({
      specAuthor: "alice",
      assignees: ["alice"],
      prAuthors: ["alice"],
      reviewers: ["alice"],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("alice");
  });

  it("should block when only one human exists with no reviews", async () => {
    const context = createMockContext();
    const activity = createMockActivity({
      specAuthor: "solo",
      assignees: ["solo"],
      prAuthors: ["solo"],
      reviewers: [],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("solo");
  });

  it("should pass when spec author differs from assignee", async () => {
    const context = createMockContext();
    const activity = createMockActivity({
      specAuthor: "alice",
      assignees: ["bob"],
      prAuthors: ["bob"],
      reviewers: [],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(true);
  });

  it("should pass when PR author differs from reviewer", async () => {
    const context = createMockContext();
    const activity = createMockActivity({
      specAuthor: "alice",
      assignees: ["alice"],
      prAuthors: ["alice"],
      reviewers: ["bob"],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(true);
  });

  it("should pass when assignee differs from PR author", async () => {
    const context = createMockContext();
    const activity = createMockActivity({
      specAuthor: "alice",
      assignees: ["alice"],
      prAuthors: ["bob"],
      reviewers: [],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(true);
  });

  it("should block when no human participants found", async () => {
    const context = createMockContext();
    const activity = createMockActivity({
      specAuthor: undefined,
      assignees: [],
      prAuthors: [],
      reviewers: [],
    });

    const result = await validateMultiRoleParticipation(context, activity);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("No human participants");
  });
});
