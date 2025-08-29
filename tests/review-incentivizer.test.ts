import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { parseGitHubUrl } from "../src/start";
import cfg from "./__mocks__/results/valid-configuration.json";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { ContextPlugin } from "../src/types/plugin-input";
import dbSeed from "./__mocks__/db-seed.json";
import { db, db as mockDb } from "./__mocks__/db";
import { server } from "./__mocks__/node";
import Mock = jest.Mock;
import { drop } from "@mswjs/data";
import { RestEndpointMethodTypes } from "@octokit/rest";
import "./helpers/permit-mock";
import { PullRequestData } from "../src/helpers/pull-request-data";

const ctx = {
  eventName: "issues.closed",
  payload: {
    issue: {
      html_url: "https://github.com/ubiquity-os/conversation-rewards/issues/5",
      number: 1,
      state_reason: "completed",
      assignees: [
        {
          id: 1,
          login: "gentlementlegen",
        },
      ],
    },
    repository: {
      name: "conversation-rewards",
      owner: {
        login: "ubiquity-os",
        id: 5,
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
  env: {
    OPENROUTER_API_KEY: "1234",
    SUPABASE_KEY: "1234",
    SUPABASE_URL: "http://localhost:6543",
    X25519_PRIVATE_KEY: "1234",
  },
} as unknown as ContextPlugin;

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Review Incentivizer", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.resetModules();
    drop(db);
  });

  it("Should not run when no PR is linked to this issue", async () => {
    const collectLinkedMergedPulls: Mock<() => Array<object>> = jest.fn(() => []);
    jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedMergedPulls: collectLinkedMergedPulls,
    }));
    const { IssueActivity } = await import("../src/issue-activity");
    const issue = parseGitHubUrl("https://github.com/ubiquity-os/conversation-rewards/issues/5");
    const activity = new IssueActivity(ctx, issue);
    await activity.init();
    for (const item of dbSeed.users) {
      mockDb.users.create(item);
    }
    for (const item of dbSeed.wallets) {
      mockDb.wallets.create(item);
    }
    for (const item of dbSeed.locations) {
      mockDb.locations.create(item);
    }
    const { Processor } = await import("../src/parser/processor");
    const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");

    const spy = jest.spyOn(console, "warn");
    const processor = new Processor(ctx);
    processor["_transformers"] = [new ReviewIncentivizerModule(ctx)];
    await processor.run(activity);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching("No pull request is linked to this issue, won't run review incentivizer")
    );
    spy.mockClear();
    spy.mockReset();
  });

  it("Should run on the linked pull-request", async () => {
    const collectLinkedMergedPulls: Mock<() => Array<object>> = jest.fn(() => [
      {
        id: "PR_kwDOLUK0B85soGlu",
        title: "feat: github comment generation and posting",
        number: 12,
        url: "https://github.com/ubiquity-os/conversation-rewards/pull/12",
        author: {
          login: "gentlementlegen",
          id: 9807008,
        },
        state: "MERGED",
        repository: {
          owner: {
            login: "ubiquity-os",
          },
          name: "conversation-rewards",
        },
      },
    ]);
    jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedMergedPulls: collectLinkedMergedPulls,
    }));
    const { IssueActivity } = await import("../src/issue-activity");
    const issue = parseGitHubUrl("https://github.com/ubiquity-os/conversation-rewards/issues/5");
    const activity = new IssueActivity(ctx, issue);
    await activity.init();
    for (const item of dbSeed.users) {
      mockDb.users.create(item);
    }
    for (const item of dbSeed.wallets) {
      mockDb.wallets.create(item);
    }
    for (const item of dbSeed.locations) {
      mockDb.locations.create(item);
    }
    const { Processor } = await import("../src/parser/processor");
    const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");

    const spy = jest.spyOn(console, "warn");
    const processor = new Processor(ctx);
    processor["_transformers"] = [new ReviewIncentivizerModule(ctx)];
    await processor.run(activity);
    expect(spy).not.toHaveBeenCalled();
    spy.mockClear();
  });

  it("Should skip removed files in review incentives diff calculation", async () => {
    jest.spyOn(ctx.octokit.rest.repos, "compareCommits").mockImplementationOnce(async () => {
      return {
        data: {
          files: [
            {
              filename: "added.txt",
              additions: 10,
              deletions: 5,
              status: "added",
            },
            {
              filename: "modified.txt",
              additions: 20,
              deletions: 10,
              status: "modified",
            },
            {
              filename: "removed.txt",
              additions: 0,
              deletions: 30,
              status: "removed",
            },
          ],
        },
      } as unknown as RestEndpointMethodTypes["repos"]["compareCommits"]["response"];
    });

    const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");
    const reviewIncentivizerModule = new ReviewIncentivizerModule(ctx);

    const diff = await reviewIncentivizerModule.getTripleDotDiffAsObject(
      "ubiquity-os",
      "conversation-rewards",
      "base",
      "head",
      new PullRequestData({} as never, "", "", 0)
    );

    expect(Object.keys(diff).length).toBe(2);
    expect(diff["added.txt"]).toEqual({ addition: 10, deletion: 5 });
    expect(diff["modified.txt"]).toEqual({ addition: 20, deletion: 10 });
    expect(diff["removed.txt"]).toEqual(undefined);
  });
});
