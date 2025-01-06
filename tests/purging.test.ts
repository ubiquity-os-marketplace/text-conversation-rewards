import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { GitHubIssueComment } from "../src/github-types";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { Processor } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import hiddenCommentPurged from "./__mocks__/results/hidden-comment-purged.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";

const issueUrl = "https://github.com/Meniole/conversation-rewards/issues/13";

jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation((specification, comments) => {
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

jest.unstable_mockModule("@actions/github", () => ({
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards",
      },
    },
  },
}));

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: jest.fn(() => []),
}));

const ctx = {
  eventName: "issues.closed",
  payload: {
    issue: {
      html_url: issueUrl,
      number: 13,
      state_reason: "completed",
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
    OPENAI_API_KEY: "1234",
    SUPABASE_URL: "http://localhost:8080",
    SUPABASE_KEY: "1234",
  },
} as unknown as ContextPlugin;

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn((comments: GitHubIssueComment[]) => {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i];
      comment.isMinimized = i === 0;
    }
  }),
}));

jest.unstable_mockModule("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({})),
  };
});

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const { IssueActivity } = await import("../src/issue-activity");

describe("Purging tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity(ctx, issue);

  beforeEach(async () => {
    drop(db);
    for (const table of Object.keys(dbSeed)) {
      const tableName = table as keyof typeof dbSeed;
      for (const row of dbSeed[tableName]) {
        db[tableName].create(row);
      }
    }
    await activity.init();
  });

  it("Should purge collapsed comments", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [new UserExtractorModule(ctx), new DataPurgeModule(ctx)];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(hiddenCommentPurged);
  });
});
