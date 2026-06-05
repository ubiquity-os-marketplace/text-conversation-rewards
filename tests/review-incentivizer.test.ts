import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { RestEndpointMethodTypes } from "@octokit/rest";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { PullRequestData } from "../src/helpers/pull-request-data";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db, db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import Mock = jest.Mock;
import { http, HttpResponse } from "msw";
import { GitHubPullRequestReviewComment, GitHubPullRequestReviewState } from "../src/github-types";

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
    const collectLinkedPulls: Mock<() => Array<object>> = jest.fn(() => []);
    jest.mock("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedPulls: collectLinkedPulls,
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
    // @ts-expect-error just for testing
    processor["_transformers"] = [new ReviewIncentivizerModule(ctx)];
    await processor.run(activity);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching("No assignees or pull request found, won't run review incentivizer module")
    );
    spy.mockClear();
    spy.mockReset();
  });

  it("Should run on the linked pull-request", async () => {
    const pr = {
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
    };
    const collectLinkedPulls: Mock<() => Array<object>> = jest.fn(() => [pr]);
    jest.mock("../src/data-collection/collect-linked-pulls", () => ({
      collectLinkedPulls: collectLinkedPulls,
    }));
    const { IssueActivity } = await import("../src/issue-activity");
    const issue = parseGitHubUrl("https://github.com/ubiquity-os/conversation-rewards/issues/5");
    const newCtx = { ...ctx };
    newCtx.payload = {
      ...structuredClone(ctx.payload),
      // @ts-expect-error pull_request in context
      pull_request: pr,
    };
    const activity = new IssueActivity(newCtx, issue);
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
    const processor = new Processor(newCtx);
    // @ts-expect-error just for testing
    processor["_transformers"] = [new ReviewIncentivizerModule(newCtx)];
    await processor.run(activity);
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringMatching("No assignees or pull request found, won't run review incentivizer module")
    );
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
      } as unknown as ReturnType<Awaited<typeof ctx.octokit.rest.repos.compareCommits>>;
    });

    const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");
    const reviewIncentivizerModule = new ReviewIncentivizerModule(ctx);
    const prData = new PullRequestData({} as never, "owner", "repo", 0);

    server.use(
      http.get(
        "https://api.github.com/repos/ubiquity-os/conversation-rewards/compare/:baseHead",
        () => {
          return HttpResponse.json({
            files: [
              {
                filename: "added.txt",
                status: "added",
                additions: 10,
                deletions: 5,
                changes: 15,
                blob_url: "https://github.com/ubiquity-os/conversation-rewards/blob/base/added.txt",
                patch:
                  "@@ -0,0 +1,10 @@\n+line1\n+line2\n+line3\n+line4\n+line5\n+line6\n+line7\n+line8\n+line9\n+line10",
              },
              {
                filename: "modified.txt",
                status: "modified",
                additions: 2,
                deletions: 1,
                changes: 3,
                blob_url: "https://github.com/ubiquity-os/conversation-rewards/blob/base/modified.txt",
                patch: "@@ -1,2 +1,2 @@\n-hello\n+hello world",
              },
            ],
          });
        },
        { once: true }
      )
    );
    jest.spyOn(PullRequestData.prototype, "fileList", "get").mockReturnValue([
      {
        filename: "added.txt",
        additions: 10,
        deletions: 5,
        sha: "sha-added",
        status: "added",
        blob_url: "blob/added",
        raw_url: "raw/added",
      } as unknown as NonNullable<RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"]["files"]>[number],
      {
        filename: "modified.txt",
        additions: 20,
        deletions: 10,
        sha: "sha-modified",
        status: "modified",
        blob_url: "blob/modified",
        raw_url: "raw/modified",
      } as unknown as NonNullable<RestEndpointMethodTypes["repos"]["getCommit"]["response"]["data"]["files"]>[number],
    ]);

    const diff = await reviewIncentivizerModule.getTripleDotDiffAsObject(
      "ubiquity-os",
      "conversation-rewards",
      "base",
      "head",
      prData
    );

    expect(Object.keys(diff).length).toBe(2);
    expect(diff["added.txt"]).toEqual({ addition: 10, deletion: 5 });
    expect(diff["modified.txt"]).toEqual({ addition: 2, deletion: 1 });
    expect(diff["removed.txt"]).toEqual(undefined);
  });

  it("Should only reward reviews that include a body or inline comments", async () => {
    const { hasRewardableReviewContent } = await import("../src/parser/review-incentivizer-module");
    const baseReview = {
      id: 1,
      body: "",
      user: { login: "reviewer" },
    } as GitHubPullRequestReviewState;

    expect(hasRewardableReviewContent(baseReview)).toBe(false);
    expect(hasRewardableReviewContent({ ...baseReview, body: "Looks good after the requested changes." })).toBe(true);
    expect(
      hasRewardableReviewContent(baseReview, [
        {
          pull_request_review_id: 1,
          user: { login: "reviewer" },
        } as GitHubPullRequestReviewComment,
      ])
    ).toBe(true);
  });

  it("Should skip approval-only reviews when calculating review rewards", async () => {
    const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");
    jest.spyOn(PullRequestData.prototype, "fetchData").mockResolvedValue(undefined);
    jest.spyOn(PullRequestData.prototype, "pullCommits", "get").mockReturnValue([
      {
        sha: "first",
        parents: [{ sha: "base" }],
        parentCount: 1,
      },
    ]);
    jest.spyOn(ReviewIncentivizerModule.prototype, "getReviewableDiff").mockResolvedValue({
      addition: 10,
      deletion: 5,
    });
    jest
      .spyOn(ctx.octokit.rest.repos, "getContent")
      .mockRejectedValue(Object.assign(new Error("Not Found"), { status: 404 }));

    const reviewIncentivizerModule = new ReviewIncentivizerModule(ctx);
    const reviews = await reviewIncentivizerModule.fetchReviewDiffRewards(
      "ubiquity-os",
      "conversation-rewards",
      "main",
      "reviewer:branch",
      [
        {
          id: 1,
          body: "I left comments on the implementation.",
          commit_id: "reviewed-commit",
          pull_request_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls/12",
          user: { login: "reviewer" },
        } as GitHubPullRequestReviewState,
        {
          id: 2,
          body: "",
          commit_id: "approval-commit",
          pull_request_url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/pulls/12",
          user: { login: "reviewer" },
        } as GitHubPullRequestReviewState,
      ],
      2
    );

    expect(reviews).toEqual([
      {
        reviewId: 1,
        effect: { addition: 10, deletion: 5 },
        reward: 0.3,
        priority: 2,
      },
    ]);
  });
});
