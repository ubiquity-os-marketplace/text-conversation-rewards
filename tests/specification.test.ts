/* eslint-disable sonarjs/no-nested-functions */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, HttpResponse } from "msw";
import { extractOriginalAuthor } from "../src/helpers/original-author";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import { mockWeb3Module } from "./helpers/web3-mocks";
import { Result } from "../src/types/results";

const issueUrl = "https://github.com/ubiquity-os/conversation-rewards/issues/71";

mockWeb3Module();

jest.unstable_mockModule("@actions/github", () => ({
  default: {},
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards",
      },
    },
    sha: "1234",
  },
}));

jest.unstable_mockModule("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        insert: jest.fn(() => ({})),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 1,
              },
            })),
            eq: jest.fn(() => ({
              single: jest.fn(() => ({
                data: {
                  id: 1,
                },
              })),
            })),
          })),
        })),
      })),
    })),
  };
});

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: jest.fn(() => []),
}));

beforeAll(() => {
  server.listen();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PaymentModule.prototype._getNetworkExplorer = (_networkId: number) => {
    return "https://rpc";
  };
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const { IssueActivity } = await import("../src/issue-activity");
const { ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module");
const { DataPurgeModule } = await import("../src/parser/data-purge-module");
const { FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module");
const { PaymentModule } = await import("../src/parser/payment-module");
const { Processor } = await import("../src/parser/processor");
const { UserExtractorModule } = await import("../src/parser/user-extractor-module");

jest.spyOn(ContentEvaluatorModule.prototype, "_getRateLimitTokens").mockImplementation(() => Promise.resolve(Infinity));

jest
  .spyOn(ContentEvaluatorModule.prototype, "_evaluateComments")
  .mockImplementation((specificationBody, comments, allComments, prComments) => {
    return Promise.resolve(
      (() => {
        const relevance: { [k: string]: number } = {};
        comments.forEach((comment) => {
          relevance[`${comment.id}`] = 0.8;
        });
        prComments.forEach((comment) => {
          relevance[`${comment.id}`] = 0.7;
        });
        return relevance;
      })()
    );
  });

describe("Content Evaluator Module Test", () => {
  const issue = parseGitHubUrl(issueUrl);
  const ctx = {
    eventName: "issues.closed",
    payload: {
      issue: {
        html_url: issueUrl,
        number: 71,
        state_reason: "completed",
        assignees: [
          {
            id: 87654321,
            login: "developer-1",
          },
        ],
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquity-os",
          id: 76412717,
        },
      },
    },
    adapters: {
      supabase: {
        wallet: {
          getWalletByUserId: jest.fn(async () => "0x1"),
        },
      },
    },
    config: cfg,
    logger: new Logs("debug"),
    octokit: new Octokit(),
    env: process.env,
  } as unknown as ContextPlugin;
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

  it("Should handle comments with original author references", async () => {
    const commentId = 1571243461;
    const originalAuthorComment = {
      id: commentId,
      node_id: "IC_kwDOKzVPS89fGhiO",
      url: "https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/comments/1571243461",
      html_url: "https://github.com/ubiquity-os/conversation-rewards/issues/71#issuecomment-1571243461",
      body: "_Originally posted by @reviewer in [#69](https://github.com/ubiquity/work.ubq.fi/issues/69)_\n\nThe implementation looks good! One suggestion - consider adding a threshold value to filter out low-relevance comments.",
      user: {
        login: "test-user",
        id: 12345678,
        node_id: "MDQ6VXNlcjEyMzQ1Njc4",
        avatar_url: "https://avatars.githubusercontent.com/u/12345678?v=4",
        gravatar_id: "",
        url: "https://api.github.com/users/test-user",
        html_url: "https://github.com/test-user",
        type: "User",
        site_admin: false,
      },
      created_at: "2023-06-25T14:00:00Z",
      updated_at: "2023-06-25T14:00:00Z",
      author_association: "MEMBER",
      performed_via_github_app: null,
    };

    const extractedInfo = extractOriginalAuthor(originalAuthorComment.body);
    expect(extractedInfo).not.toBeNull();
    expect(extractedInfo?.username).toBe("reviewer");
    expect(extractedInfo?.url).toBe("https://github.com/ubiquity/work.ubq.fi/issues/69");

    server.use(
      http.get("https://api.github.com/repos/ubiquity-os/conversation-rewards/issues/71/comments", () => {
        const modifiedComments = [...activity.comments, originalAuthorComment];
        return HttpResponse.json(modifiedComments);
      })
    );

    await activity.init();

    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];

    await processor.run(activity);

    const result = JSON.parse(processor.dump()) as Result;

    const users = Object.keys(result);
    const hasOriginalAuthor = users.some((user) => user === "reviewer");
    expect(hasOriginalAuthor).toBeTruthy();
    expect(result["reviewer"].total).toEqual(8.3201);
    // "reviewer" should also be credited for the spec even though it didn't write it, due to the "originally posted by"
    expect(result["reviewer"].comments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: activity.self?.id })])
    );
  }, 120000);
});
