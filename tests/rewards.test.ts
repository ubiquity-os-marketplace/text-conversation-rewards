/* eslint-disable sonarjs/no-nested-functions */

import { afterAll, afterEach, beforeAll, beforeEach, describe, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import fs from "fs";
import { http, passthrough } from "msw";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db, db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import rewardSplitResult from "./__mocks__/results/reward-split.json";
import cfg from "./__mocks__/results/valid-configuration.json";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

jest.unstable_mockModule("@actions/github", () => ({
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

jest.unstable_mockModule("@ubiquity-os/permit-generation", () => {
  const originalModule: object = jest.requireActual("@ubiquity-os/permit-generation");

  return {
    __esModule: true,
    ...originalModule,
    createAdapters: jest.fn(() => {
      return {
        supabase: {
          wallet: {
            getWalletByUserId: jest.fn((userId: number) => {
              const wallet = mockDb.wallets.findFirst({
                where: {
                  userId: {
                    equals: userId,
                  },
                },
              });
              if (!wallet) {
                return Promise.resolve(`[mock] Could not find wallet for user ${userId}`);
              }
              return Promise.resolve(wallet.address);
            }),
          },
        },
      };
    }),
  };
});

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

jest.unstable_mockModule("../src/helpers/web3", () => ({
  getErc20TokenSymbol() {
    return "WXDAI";
  },
}));

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: jest.fn(() => [
    {
      id: "PR_kwDOKzVPS85zXUoj",
      title: "fix: add state to sorting manager for bottom and top",
      number: 70,
      url: "https://github.com/ubiquity/work.ubq.fi/pull/70",
      author: {
        login: "0x4007",
        id: 4975670,
      },
      repository: {
        owner: {
          login: "ubiquity",
        },
        name: "work.ubq.fi",
      },
    },
  ]),
}));

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const { IssueActivity } = await import("../src/issue-activity");
const { ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module");
const { DataPurgeModule } = await import("../src/parser/data-purge-module");
const { FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module");
const { GithubCommentModule } = await import("../src/parser/github-comment-module");
const { PermitGenerationModule } = await import("../src/parser/permit-generation-module");
const { Processor } = await import("../src/parser/processor");
const { UserExtractorModule } = await import("../src/parser/user-extractor-module");

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

describe("Rewards tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const ctx = {
    eventName: "issues.closed",
    payload: {
      issue: {
        html_url: issueUrl,
        number: 69,
        state_reason: "completed",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquity-os",
          id: 76412717, // https://github.com/ubiquity
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

  it("Should split the rewards between multiple assignees", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new PermitGenerationModule(ctx),
      new GithubCommentModule(ctx),
    ];
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(rewardSplitResult);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output-reward-split.html", "utf-8")
    );
  });
});
