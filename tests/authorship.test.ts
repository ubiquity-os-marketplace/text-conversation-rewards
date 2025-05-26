/* eslint-disable sonarjs/no-nested-functions */

import { afterAll, afterEach, beforeAll, beforeEach, describe, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import fs from "fs";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import authorshipRewardResult from "./__mocks__/results/authorship-reward.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import { mockWeb3Module } from "./helpers/web3-mocks";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/100";

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
  collectLinkedMergedPulls: jest.fn(() => [
    {
      id: "PR_kwDOKzVPS85zXUoj",
      title: "fix: add authorship to issue body edits",
      number: 101,
      url: "https://github.com/ubiquity/work.ubq.fi/pull/101",
      author: {
        login: "contributor1",
        id: 4975670,
      },
      state: "MERGED",
      repository: {
        owner: {
          login: "ubiquity",
        },
        name: "work.ubq.fi",
      },
    },
  ]),
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
const { GithubCommentModule } = await import("../src/parser/github-comment-module");
const { PaymentModule } = await import("../src/parser/payment-module");
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

jest.spyOn(ContentEvaluatorModule.prototype, "_getRateLimitTokens").mockImplementation(() => Promise.resolve(Infinity));

describe("Authorship tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const ctx = {
    eventName: "issues.closed",
    payload: {
      issue: {
        html_url: issueUrl,
        number: 100,
        state_reason: "completed",
        assignees: [
          {
            id: 1,
            login: "issueCreator",
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

  it("Should distribute rewards based on authorship percentages in issue body edits", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new GithubCommentModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(authorshipRewardResult);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output-authorship-reward.html", "utf-8")
    );
  }, 120000);
});
