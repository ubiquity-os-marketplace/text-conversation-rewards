/* eslint-disable sonarjs/no-nested-functions */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, passthrough } from "msw";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import originalpaymentResults from "./__mocks__/results/permit-generation-results.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import { parseUnits } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { ERC20_ABI, PERMIT2_ABI } from "../src/helpers/web3";
import { PayoutMode } from "../src/types/results";
import "./helpers/permit-mock";

const issueUrl = process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquity-os/conversation-rewards/issues/5";

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

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

jest.unstable_mockModule("../src/helpers/checkers", () => ({
  isAdmin: jest.fn(),
  isCollaborative: jest.fn(),
}));

const { isAdmin, isCollaborative } = await import("../src/helpers/checkers");

const isAdminMocked = isAdmin as jest.Mock;
const isCollaborativeMocked = isCollaborative as jest.Mock;

const ctx = {
  stateId: 1,
  eventName: "issues.closed",
  authToken: process.env.GITHUB_TOKEN,
  ref: "",
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
        id: 76412717, // https://github.com/ubiquity
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
  octokit: new (Octokit.plugin(paginateGraphQL).defaults({ auth: process.env.GITHUB_TOKEN }))(),
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    X25519_PRIVATE_KEY: process.env.X25519_PRIVATE_KEY,
  },
  commentHandler: {
    postComment: jest.fn(),
  },
} as unknown as ContextPlugin;

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

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: jest.fn(() => [
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
  ]),
}));

jest.unstable_mockModule("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                wallets: {
                  address: "0xAddress",
                },
              },
            })),
          })),
        })),
      })),
    })),
  };
});

const { IssueActivity } = await import("../src/issue-activity");
const { ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module");
const { DataPurgeModule } = await import("../src/parser/data-purge-module");
const { FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module");
const { PaymentModule } = await import("../src/parser/payment-module");
const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");
const { Processor } = await import("../src/parser/processor");
const { UserExtractorModule } = await import("../src/parser/user-extractor-module");
const { EventIncentivesModule } = await import("../src/parser/event-incentives-module");
const { SimplificationIncentivizerModule } = await import("../src/parser/simplification-incentivizer-module");

const issue = parseGitHubUrl(issueUrl);
const activity = new IssueActivity(ctx, issue);

beforeAll(async () => {
  server.listen();

  // eslint-disable-next-line @typescript-eslint/naming-convention
  PaymentModule.prototype._getNetworkExplorer = async (_networkId: number) => {
    return Promise.resolve("https://rpc");
  };

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
});

afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});

afterAll(() => {
  server.close();
});

// Run the test twice to cover both auto-transfer and permit-generation modes.
const automaticTransferModeVector = [false, true];
interface UserData {
  [key: string]: unknown;
}

interface JsonData {
  [key: string]: UserData;
}
let paymentResults: JsonData = {};
describe.each(automaticTransferModeVector)("Payment Module Tests", (automaticTransferMode) => {
  beforeAll(async () => {
    ctx.config.incentives.payment = { automaticTransferMode: automaticTransferMode };
    paymentResults = { ...originalpaymentResults };
    const payoutMode: PayoutMode = automaticTransferMode ? "transfer" : "permit";

    for (const username of Object.keys(paymentResults)) {
      if (!paymentResults[username]["permitUrl"] && !automaticTransferMode) continue; // getWalletByUserId mock returns null here

      if (automaticTransferMode) {
        delete paymentResults[username]["permitUrl"];
        paymentResults[username].explorerUrl = "https://rpc/tx/0xSent";
      }
      paymentResults[username].payoutMode = payoutMode;
    }
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest
      .spyOn(ContentEvaluatorModule.prototype, "_evaluateComments")
      .mockImplementation((specificationBody, commentsToEvaluate, allComments, prCommentsToEvaluate) => {
        return Promise.resolve(
          (() => {
            const relevance: { [k: string]: number } = {};
            commentsToEvaluate.forEach((comment) => {
              relevance[`${comment.id}`] = 0.8;
            });
            prCommentsToEvaluate.forEach((comment) => {
              relevance[`${comment.id}`] = 0.7;
            });
            return relevance;
          })()
        );
      });
    jest
      .spyOn(ContentEvaluatorModule.prototype, "_getRateLimitTokens")
      .mockImplementation(() => Promise.resolve(Infinity));
    jest.spyOn(ReviewIncentivizerModule.prototype, "getTripleDotDiffAsObject").mockImplementation(async () => {
      return {
        "test.txt": {
          addition: 50,
          deletion: 50,
        },
      };
    });
  });

  describe(`Admin User Tests (automaticTransferMode : ${automaticTransferMode})`, () => {
    beforeEach(() => {
      isAdminMocked.mockImplementation(() => Promise.resolve(true));
    });

    it(`should pay for collaborative issue`, async () => {
      isCollaborativeMocked.mockImplementation(() => true);

      const processor = new Processor(ctx);
      processor["_transformers"] = [
        new UserExtractorModule(ctx),
        new DataPurgeModule(ctx),
        new FormattingEvaluatorModule(ctx),
        new ContentEvaluatorModule(ctx),
        new ReviewIncentivizerModule(ctx),
        new EventIncentivesModule(ctx),
        new SimplificationIncentivizerModule(ctx),
        new PaymentModule(ctx),
      ];

      server.use(http.post("https://*", () => passthrough()));
      await processor.run(activity);

      const result = JSON.parse(processor.dump());
      expect(result).toEqual(paymentResults);
    });

    it(`should pay for non - collaborative issue`, async () => {
      isCollaborativeMocked.mockImplementation(() => false);

      const processor = new Processor(ctx);
      processor["_transformers"] = [
        new UserExtractorModule(ctx),
        new DataPurgeModule(ctx),
        new FormattingEvaluatorModule(ctx),
        new ContentEvaluatorModule(ctx),
        new ReviewIncentivizerModule(ctx),
        new EventIncentivesModule(ctx),
        new SimplificationIncentivizerModule(ctx),
        new PaymentModule(ctx),
      ];

      server.use(http.post("https://*", () => passthrough()));
      await processor.run(activity);

      const result = JSON.parse(processor.dump());
      expect(result).toEqual(paymentResults);
    });
  });

  describe(`Non - Admin User Tests(automaticTransferMode : ${automaticTransferMode})`, () => {
    beforeEach(() => {
      isAdminMocked.mockImplementation(() => Promise.resolve(false));
    });

    it(`should pay for collaborative issue`, async () => {
      isCollaborativeMocked.mockImplementation(() => true);

      const processor = new Processor(ctx);
      processor["_transformers"] = [
        new UserExtractorModule(ctx),
        new DataPurgeModule(ctx),
        new FormattingEvaluatorModule(ctx),
        new ContentEvaluatorModule(ctx),
        new ReviewIncentivizerModule(ctx),
        new EventIncentivesModule(ctx),
        new SimplificationIncentivizerModule(ctx),
        new PaymentModule(ctx),
      ];

      server.use(http.post("https://*", () => passthrough()));
      await processor.run(activity);

      const result = JSON.parse(processor.dump());
      expect(result).toEqual(paymentResults);
    });

    it(`should not pay for non - collaborative issue`, async () => {
      isCollaborativeMocked.mockImplementation(() => false);

      const processor = new Processor(ctx);
      processor["_transformers"] = [
        new UserExtractorModule(ctx),
        new DataPurgeModule(ctx),
        new FormattingEvaluatorModule(ctx),
        new ContentEvaluatorModule(ctx),
        new ReviewIncentivizerModule(ctx),
        new EventIncentivesModule(ctx),
        new SimplificationIncentivizerModule(ctx),
        new PaymentModule(ctx),
      ];

      server.use(http.post("https://*", () => passthrough()));
      await processor.run(activity);

      const result = JSON.parse(processor.dump());
      expect(result).not.toEqual(paymentResults);
    });
  });
});
