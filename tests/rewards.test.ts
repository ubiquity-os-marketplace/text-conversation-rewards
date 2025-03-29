/* eslint-disable sonarjs/no-nested-functions */

import { afterAll, afterEach, beforeAll, beforeEach, describe, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import fs from "fs";
import { http, passthrough } from "msw";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import rewardSplitResult from "./__mocks__/results/reward-split.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { PERMIT2_ABI, ERC20_ABI, isEthersError } from "../src/helpers/web3";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

const mockRewardTokenBalance = jest.fn().mockReturnValue(parseUnits("20000", 18) as BigNumber);
jest.unstable_mockModule("../src/helpers/web3", () => {
  class MockErc20Wrapper {
    getBalance = mockRewardTokenBalance;
    getSymbol = jest.fn().mockReturnValue("WXDAI");
    getDecimals = jest.fn().mockReturnValue(18);
    getAllowance = mockRewardTokenBalance;
  }
  class MockPermit2Wrapper {
    generateBatchTransferPermit = jest.fn().mockReturnValue({
      signature: "signature",
    });
    sendPermitTransferFrom = jest
      .fn()
      .mockReturnValue({ hash: `0xSent`, wait: async () => Promise.resolve({ blockNumber: 1 }) });
    estimatePermitTransferFromGas = jest.fn().mockReturnValue(parseUnits("0.02", 18));
  }
  return {
    PERMIT2_ABI: PERMIT2_ABI,
    ERC20_ABI: ERC20_ABI,
    isEthersError: isEthersError,
    Erc20Wrapper: MockErc20Wrapper,
    Permit2Wrapper: MockPermit2Wrapper,
    getContract: jest.fn().mockReturnValue({ provider: "dummy" }),
    getEvmWallet: jest.fn(() => ({
      address: "0xAddress",
      getBalance: jest.fn().mockReturnValue(parseUnits("1", 18)),
    })),
  };
});

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
      title: "fix: add state to sorting manager for bottom and top",
      number: 70,
      url: "https://github.com/ubiquity/work.ubq.fi/pull/70",
      author: {
        login: "0x4007",
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
  PaymentModule.prototype._getNetworkExplorer = async (_networkId: number) => {
    return Promise.resolve("https://rpc");
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

describe("Rewards tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const ctx = {
    eventName: "issues.closed",
    payload: {
      issue: {
        html_url: issueUrl,
        number: 69,
        state_reason: "completed",
        assignees: [
          {
            id: 1,
            login: "gentlementlegen",
          },
          {
            id: 2,
            login: "0x4007",
          },
        ],
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
      new PaymentModule(ctx),
      new GithubCommentModule(ctx),
    ];
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(rewardSplitResult);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output-reward-split.html", "utf-8")
    );
  }, 120000);
});
