import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import "./helpers/permit-mock";
import { drop } from "@mswjs/data";
import { CommentAssociation, CommentKind } from "../src/configuration/comment-types";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { GitHubIssueComment } from "../src/github-types";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import hiddenCommentPurged from "./__mocks__/results/hidden-comment-purged.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import { Octokit } from "@octokit/rest";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { IssueActivity } from "../src/issue-activity";

const issueUrl = "https://github.com/Meniole/conversation-rewards/issues/13";

jest
  .spyOn(ContentEvaluatorModule.prototype, "_evaluateComments")
  .mockImplementation((specification, userId, comments) => {
    return Promise.resolve(
      (() => {
        const relevance: { [k: string]: number } = {};
        comments.forEach((comment) => {
          relevance[`${comment.id}`] = 0.8;
        });
        return relevance;
      })()
    );
  });

jest.mock("@actions/github", () => ({
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards",
      },
    },
  },
}));

jest.mock("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedPulls: jest.fn(() => []),
}));

const ctx = {
  eventName: "issues.closed",
  payload: {
    issue: {
      html_url: issueUrl,
      number: 13,
      state_reason: "completed",
      assignees: [],
    },
    repository: {
      name: "conversation-rewards",
      owner: {
        login: "ubiquity-os",
        id: 76412717,
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
  env: {
    SUPABASE_URL: "http://localhost:8080",
    SUPABASE_KEY: "1234",
  },
  commentHandler: {
    postComment: jest.fn(),
  },
} as unknown as ContextPlugin;

jest.mock("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn((comments: GitHubIssueComment[]) => {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      comment.isMinimized = i === 0;
    }
  }),
}));

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({})),
  };
});

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Purging tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  let activity: IssueActivity;

  beforeEach(async () => {
    drop(db);
    for (const table of Object.keys(dbSeed)) {
      const tableName = table as keyof typeof dbSeed;
      for (const row of dbSeed[tableName]) {
        db[tableName].create(row);
      }
    }
    const { IssueActivity } = await import("../src/issue-activity");
    activity = new IssueActivity(ctx, issue);
    await activity.init();
  });

  it("Should purge collapsed comments", async () => {
    const { Processor } = await import("../src/parser/processor");

    const processor = new Processor(ctx);
    // @ts-expect-error only for testing
    processor["_transformers"] = [new UserExtractorModule(ctx), new DataPurgeModule(ctx)];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(hiddenCommentPurged);
  });

  it("keeps previous assignee issue comments only when the close-only toggle is enabled", async () => {
    const previousAssigneeComment = {
      id: 1,
      body: "researched the spec and found constraints",
      created_at: "2024-01-02T00:00:00Z",
      html_url: `${issueUrl}#issuecomment-1`,
      user: { login: "former-assignee", type: "User" },
      commentType: CommentKind.ISSUE | CommentAssociation.CONTRIBUTOR,
    } as Awaited<ReturnType<IssueActivity["getAllComments"]>>[0];
    const currentAssigneeComment = {
      id: 2,
      body: "implemented and researched this while assigned",
      created_at: "2024-01-02T00:00:00Z",
      html_url: `${issueUrl}#issuecomment-2`,
      user: { login: "current-assignee", type: "User" },
      commentType: CommentKind.ISSUE | CommentAssociation.ASSIGNEE,
    } as Awaited<ReturnType<IssueActivity["getAllComments"]>>[0];

    const assignmentPeriods = {
      "former-assignee": [{ assignedAt: "2024-01-01T00:00:00Z", unassignedAt: "2024-01-03T00:00:00Z" }],
      "current-assignee": [{ assignedAt: "2024-01-01T00:00:00Z", unassignedAt: "2024-01-03T00:00:00Z" }],
    };

    const baseResult = {
      "former-assignee": { total: 0, userId: 1 },
      "current-assignee": { total: 0, userId: 2 },
    };

    const disabledModule = new DataPurgeModule(ctx);
    disabledModule._assignmentPeriods = assignmentPeriods;
    disabledModule._currentAssigneeLogins = new Set(["current-assignee"]);

    expect(await disabledModule._shouldSkipComment(previousAssigneeComment)).toBe(true);
    expect(await disabledModule._shouldSkipComment(currentAssigneeComment)).toBe(true);

    const enabledCtx = {
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          dataPurge: {
            ...ctx.config.incentives.dataPurge,
            skipCommentsWhileAssignedForCurrentAssigneeOnly: true,
          },
        },
      },
    } as unknown as ContextPlugin;
    const enabledModule = new DataPurgeModule(enabledCtx);
    enabledModule._assignmentPeriods = assignmentPeriods;
    enabledModule._currentAssigneeLogins = new Set(["current-assignee"]);

    expect(await enabledModule._shouldSkipComment(previousAssigneeComment)).toBe(false);
    expect(await enabledModule._shouldSkipComment(currentAssigneeComment)).toBe(true);

    const transformed = structuredClone(baseResult);
    await enabledModule["_processComment"](previousAssigneeComment, transformed);
    await enabledModule["_processComment"](currentAssigneeComment, transformed);

    expect((transformed["former-assignee"] as { comments?: unknown[] }).comments).toHaveLength(1);
    expect((transformed["current-assignee"] as { comments?: unknown[] }).comments).toBeUndefined();
  });

  it("does not skip current assignee issue comments on not planned closures when the toggle is enabled", async () => {
    const comment = {
      id: 3,
      body: "researched this but it is not feasible",
      created_at: "2024-01-02T00:00:00Z",
      html_url: `${issueUrl}#issuecomment-3`,
      user: { login: "current-assignee", type: "User" },
      commentType: CommentKind.ISSUE | CommentAssociation.ASSIGNEE,
    } as Awaited<ReturnType<IssueActivity["getAllComments"]>>[0];

    const notPlannedCtx = {
      ...ctx,
      payload: {
        ...ctx.payload,
        issue: {
          ...(ctx as any).payload.issue,
          state_reason: "not_planned",
          assignees: [{ id: 2, login: "current-assignee" }],
        },
      },
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          dataPurge: {
            ...ctx.config.incentives.dataPurge,
            skipCommentsWhileAssignedForCurrentAssigneeOnly: true,
          },
        },
      },
    } as unknown as ContextPlugin;

    const module = new DataPurgeModule(notPlannedCtx);
    module._assignmentPeriods = {
      "current-assignee": [{ assignedAt: "2024-01-01T00:00:00Z", unassignedAt: "2024-01-03T00:00:00Z" }],
    };
    module._currentAssigneeLogins = new Set(["current-assignee"]);

    expect(await module._shouldSkipComment(comment)).toBe(false);
  });
});
