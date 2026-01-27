/* eslint-disable sonarjs/no-nested-functions */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, passthrough } from "msw";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { PayoutMode } from "../src/types/results";
import { db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import originalpaymentResults from "./__mocks__/results/permit-generation-results.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";
import { mockWeb3Module } from "./helpers/web3-mocks";

const TEST_X25519_PRIVATE_KEY = "wrQ9wTI1bwdAHbxk2dfsvoK1yRwDc0CEenmMXFvGYgY";
process.env.X25519_PRIVATE_KEY = TEST_X25519_PRIVATE_KEY;

const issueUrl = process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquity-os/conversation-rewards/issues/5";

mockWeb3Module();

jest.mock("@actions/github", () => ({
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

jest.mock("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

jest.mock("../src/helpers/checkers", () => ({
  isAdmin: jest.fn(),
  isCollaborative: jest.fn(),
}));

const ctx = {
  stateId: 1,
  eventName: "issues.closed",
  authToken: process.env.GITHUB_TOKEN,
  ref: "refs/heads/main",
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
  adapters: {
    supabase: {
      location: {
        getOrCreateIssueLocation: jest.fn(async () => 1),
      },
      wallet: {
        getWalletByUserId: jest.fn(async () => "0x1"),
      },
    },
  },
  config: cfg,
  logger: new Logs("debug"),
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
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

function createEqChain() {
  const chain = {
    eq: jest.fn(() => chain),
    single: jest.fn(() => ({
      data: {
        id: 1,
      },
    })),
  };
  return chain;
}

jest.mock("@supabase/supabase-js", () => {
  return {
    createClient: jest.fn(() => ({
      rpc: jest.fn(async () => ({ error: null })),
      from: jest.fn(() => ({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 1,
              },
            })),
          })),
        })),
        select: jest.fn(() => createEqChain()),
      })),
    })),
  };
});

jest.mock("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedPulls: jest.fn(() => [
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

/* eslint-disable @typescript-eslint/naming-convention */
let IssueActivity: typeof import("../src/issue-activity").IssueActivity;
let ContentEvaluatorModule: typeof import("../src/parser/content-evaluator-module").ContentEvaluatorModule;
let DataPurgeModule: typeof import("../src/parser/data-purge-module").DataPurgeModule;
let FormattingEvaluatorModule: typeof import("../src/parser/formatting-evaluator-module").FormattingEvaluatorModule;
let PaymentModule: typeof import("../src/parser/payment-module").PaymentModule;
let ReviewIncentivizerModule: typeof import("../src/parser/review-incentivizer-module").ReviewIncentivizerModule;
let Processor: typeof import("../src/parser/processor").Processor;
let UserExtractorModule: typeof import("../src/parser/user-extractor-module").UserExtractorModule;
let EventIncentivesModule: typeof import("../src/parser/event-incentives-module").EventIncentivesModule;
let SimplificationIncentivizerModule: typeof import("../src/parser/simplification-incentivizer-module").SimplificationIncentivizerModule;
/* eslint-enable @typescript-eslint/naming-convention */

let activity: InstanceType<typeof IssueActivity>;

beforeAll(async () => {
  ({ IssueActivity } = await import("../src/issue-activity"));
  ({ ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module"));
  ({ DataPurgeModule } = await import("../src/parser/data-purge-module"));
  ({ FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module"));
  ({ PaymentModule } = await import("../src/parser/payment-module"));
  ({ ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module"));
  ({ Processor } = await import("../src/parser/processor"));
  ({ UserExtractorModule } = await import("../src/parser/user-extractor-module"));
  ({ EventIncentivesModule } = await import("../src/parser/event-incentives-module"));
  ({ SimplificationIncentivizerModule } = await import("../src/parser/simplification-incentivizer-module"));

  const issue = parseGitHubUrl(issueUrl);
  activity = new IssueActivity(ctx, issue);

  server.listen();

  PaymentModule.prototype._getNetworkExplorer = (_networkId: number) => {
    return "https://rpc";
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
  let isAdminMocked: jest.Mock;
  let isCollaborativeMocked: jest.Mock;

  beforeAll(async () => {
    const { isAdmin, isCollaborative } = await import("../src/helpers/checkers");

    isAdminMocked = isAdmin as jest.Mock;
    isCollaborativeMocked = isCollaborative as jest.Mock;
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
      .mockImplementation((specificationBody, userId, commentsToEvaluate) => {
        return Promise.resolve(
          (() => {
            const relevance: { [k: string]: number } = {};
            commentsToEvaluate.forEach((comment) => {
              relevance[`${comment.id}`] = 0.8;
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
        "test.ts": {
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
      // @ts-expect-error just for testing
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
      // @ts-expect-error just for testing
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
      // @ts-expect-error just for testing
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
      // @ts-expect-error just for testing
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
