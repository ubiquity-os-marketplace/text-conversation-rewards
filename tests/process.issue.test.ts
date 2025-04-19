/* eslint-disable sonarjs/no-nested-functions */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Octokit, RestEndpointMethodTypes } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import fs from "fs";
import { http, HttpResponse, passthrough } from "msw";
import OpenAI from "openai";
import { CommentAssociation } from "../src/configuration/comment-types";
import { GitHubIssue } from "../src/github-types";
import { retry } from "../src/helpers/retry";
import { ERC20_ABI, PERMIT2_ABI } from "../src/helpers/web3";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { Result } from "../src/types/results";
import { db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import contentEvaluatorResults from "./__mocks__/results/content-evaluator-results.json";
import dataPurgeResults from "./__mocks__/results/data-purge-result.json";
import eventIncentivesResults from "./__mocks__/results/event-incentives-results.json";
import simplificationIncentivizerResults from "./__mocks__/results/simplification-incentivizer.results.json";
import formattingEvaluatorResults from "./__mocks__/results/formatting-evaluator-results.json";
import githubCommentResults from "./__mocks__/results/github-comment-results.json";
import githubCommentAltResults from "./__mocks__/results/github-comment-zero-results.json";
import paymentResults from "./__mocks__/results/permit-generation-results.json";
import reviewIncentivizerResult from "./__mocks__/results/review-incentivizer-results.json";
import userCommentResults from "./__mocks__/results/user-comment-results.json";
import cfg from "./__mocks__/results/valid-configuration.json";
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
        id: 76412717, // https://github.com/ubiquity
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
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
  env: {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    X25519_PRIVATE_KEY: process.env.X25519_PRIVATE_KEY,
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

const { IssueActivity } = await import("../src/issue-activity");
const { ContentEvaluatorModule } = await import("../src/parser/content-evaluator-module");
const { DataPurgeModule } = await import("../src/parser/data-purge-module");
const { FormattingEvaluatorModule } = await import("../src/parser/formatting-evaluator-module");
const { GithubCommentModule } = await import("../src/parser/github-comment-module");
const { PaymentModule } = await import("../src/parser/payment-module");
const { Processor } = await import("../src/parser/processor");
const { UserExtractorModule } = await import("../src/parser/user-extractor-module");
const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");
const { EventIncentivesModule } = await import("../src/parser/event-incentives-module");
const { SimplificationIncentivizerModule } = await import("../src/parser/simplification-incentivizer-module");

beforeAll(() => {
  server.listen();
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PaymentModule.prototype._getNetworkExplorer = async (_networkId: number) => {
    return Promise.resolve("https://rpc");
  };
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Modules tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity(ctx, issue);

  beforeAll(async () => {
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

  beforeEach(async () => {
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

    jest.spyOn(ctx.octokit.rest.repos, "compareCommits").mockImplementation(async () => {
      return {
        data: {
          files: [
            {
              filename: "test.txt",
              additions: 50,
              deletions: 50,
              status: "added",
            },
          ],
        },
      } as unknown as RestEndpointMethodTypes["repos"]["compareCommits"]["response"];
    });
  });

  it("Should extract users from comments", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [new UserExtractorModule(ctx)];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(userCommentResults);
  });

  it("Should purge data", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [new UserExtractorModule(ctx), new DataPurgeModule(ctx)];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(dataPurgeResults);
  });

  it("Should evaluate formatting", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(formattingEvaluatorResults);
  });

  it("Should evaluate content", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(contentEvaluatorResults);
  });

  it("Should throw on a failed LLM evaluation", async () => {
    jest.spyOn(ContentEvaluatorModule.prototype, "_evaluateComments").mockImplementation(() => {
      return Promise.resolve({});
    });

    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    await expect(processor.run(activity)).rejects.toMatchObject({
      logMessage: {
        diff: "> [!CAUTION]\n> There was a mismatch between the relevance scores and amount of comments.",
        level: "error",
        raw: "There was a mismatch between the relevance scores and amount of comments.",
        type: "error",
      },
    });
  });

  it("Should incentivize reviews", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(reviewIncentivizerResult);
  });

  it("Should incentivize events", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(eventIncentivesResults);
  });

  it("Should incentivize simplifications", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
      new SimplificationIncentivizerModule(ctx),
    ];
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(simplificationIncentivizerResults);
  });

  it("Should generate permits", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
      new PaymentModule(ctx),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(paymentResults);
  });

  it("Should generate GitHub comment", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new EventIncentivesModule(ctx),
      new PaymentModule(ctx),
      new GithubCommentModule(ctx),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(githubCommentResults);
    expect(fs.readFileSync("./output.html", "utf-8")).toEqual(
      fs.readFileSync("./tests/__mocks__/results/output.html", "utf-8")
    );
  }, 120000);

  it("Should generate GitHub comment without zero total", async () => {
    const githubCommentModule = new GithubCommentModule(ctx);
    const postBody = await githubCommentModule.getBodyContent(
      // @ts-expect-error only needed to fulfill the function signature
      {},
      githubCommentAltResults as unknown as Result
    );
    expect(postBody).not.toContain("whilefoo");
  });

  describe("Reward limits", () => {
    it("Should return infinity if disabled", () => {
      const processor = new Processor({
        ...ctx,
        config: {
          ...ctx.config,
          incentives: {
            ...ctx.config.incentives,
            limitRewards: false,
          },
        },
      });
      const result = processor._getRewardsLimit({} as unknown as GitHubIssue);
      expect(result).toBe(Infinity);
    });
  });

  it("Should return 0 when priceTagReward is 0 (due to Price: 0 label)", () => {
    const processor = new Processor({
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          limitRewards: true,
        },
      },
    });

    const mockIssueWithZeroPrice = { labels: [{ name: "Price: 0 USD" }] } as unknown as GitHubIssue;

    const rewardLimit = processor._getRewardsLimit(mockIssueWithZeroPrice);
    expect(rewardLimit).toBe(0);

    const priceTagReward = 0;
    const oldImplementationResult = priceTagReward || Infinity;
    expect(oldImplementationResult).toBe(Infinity);

    const newImplementationResult = priceTagReward ?? Infinity;
    expect(newImplementationResult).toBe(0);
  });

  it("Should return the max corresponding to the label of the issue if enabled", async () => {
    const processor = new Processor({
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          limitRewards: true,
        },
      },
    });
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
    ];
    processor["_result"] = {
      user1: {
        total: 999,
        task: {
          multiplier: 0.5,
          reward: 18.5,
        },
        userId: 0,
      },
      user2: {
        total: 11111111,
        userId: 1,
      },
    };
    const result = processor._getRewardsLimit({ labels: [{ name: "Price: 9.25 USD" }] } as unknown as GitHubIssue);
    expect(result).toBe(9.25);
    let oldLabels = null;
    if (activity.self?.labels) {
      oldLabels = activity.self.labels;
      activity.self.labels = [{ name: "Price: 9.25 USD" }];
    }
    const total = await processor.run(activity);
    expect(total).toMatchObject({
      user1: { total: 9.25, task: { multiplier: 0.5, reward: 18.5 }, userId: 0 },
      user2: { total: 0, userId: 1 },
      "0x4007": {
        total: 9.25,
      },
      whilefoo: {
        total: 9.25,
      },
    });
    if (oldLabels && activity.self) {
      activity.self.labels = oldLabels;
    }
  });

  it("Should not limit the assigned user", async () => {
    const processor = new Processor({
      ...ctx,
      config: {
        ...ctx.config,
        incentives: {
          ...ctx.config.incentives,
          limitRewards: true,
        },
      },
    });
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
    ];
    processor["_result"] = {
      gentlementlegen: {
        total: 999,
        task: {
          multiplier: 0.5,
          reward: 18.5,
        },
        comments: [
          {
            id: 1,
            content: "",
            url: "",
            commentType: CommentAssociation.ASSIGNEE,
            score: {
              reward: 50000,
              multiplier: 3,
            },
          },
        ],
        userId: 9807008,
      },
      user2: {
        total: 11111111,
        userId: 1,
      },
    };
    const result = processor._getRewardsLimit({ labels: [{ name: "Price: 9.25 USD" }] } as unknown as GitHubIssue);
    expect(result).toBe(9.25);
    const total = await processor.run(activity);
    expect(total).toMatchObject({
      gentlementlegen: { total: 800, task: { multiplier: 1, reward: 400 }, userId: 9807008 },
      user2: { total: 0, userId: 1 },
      "0x4007": {
        total: 400,
      },
      whilefoo: {
        total: 40.068,
      },
    });
  });

  it("It should warn the user if wallet is not set", async () => {
    const context = {
      ...ctx,
      adapters: {
        ...ctx.adapters,
        supabase: {
          wallet: {
            getWalletByUserId: jest.fn(async (userId: number) => {
              if (userId === githubCommentResults["whilefoo"].userId) {
                return null;
              }
              return "0x1";
            }),
          },
        },
      },
    } as unknown as ContextPlugin;
    const processor = new Processor(context);
    processor["_transformers"] = [
      new UserExtractorModule(context),
      new DataPurgeModule(context),
      new FormattingEvaluatorModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result["whilefoo"].evaluationCommentHtml).toContain("Wallet address is not set");
  }, 120000);

  it("It should warn the user if wallet could not be fetched", async () => {
    const context = {
      ...ctx,
      adapters: {
        ...ctx.adapters,
        supabase: {
          wallet: {
            getWalletByUserId: jest.fn(async (userId: number) => {
              if (userId === githubCommentResults["whilefoo"].userId) {
                throw new Error("Connection error");
              }
              return "0x1";
            }),
          },
        },
      },
    } as unknown as ContextPlugin;
    const processor = new Processor(context);
    processor["_transformers"] = [
      new UserExtractorModule(context),
      new DataPurgeModule(context),
      new FormattingEvaluatorModule(context),
      new PaymentModule(context),
      new GithubCommentModule(context),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result["whilefoo"].evaluationCommentHtml).toContain("Error fetching wallet");
  }, 120000);
});

describe("Retry", () => {
  const openAi = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, maxRetries: 0 });

  async function testFunction() {
    return openAi.chat.completions.create({
      model: "gpt-4o-2024-08-06",
      messages: [
        {
          role: "system",
          content: "",
        },
      ],
    });
  }

  it("should return correct value", async () => {
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        return HttpResponse.json({ choices: [{ text: "Hello" }] });
      })
    );

    const res = await retry(testFunction, { maxRetries: 3 });
    expect(res).toMatchObject({ choices: [{ text: "Hello" }] });
  });

  it("should retry on any error", async () => {
    let called = 0;
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        called += 1;
        if (called === 1) {
          return HttpResponse.text("", { status: 500 });
        } else if (called === 2) {
          return HttpResponse.text("", { status: 429 });
        } else {
          return HttpResponse.json({ choices: [{ text: "Hello" }] });
        }
      })
    );

    const res = await retry(testFunction, { maxRetries: 3 });
    expect(res).toMatchObject({ choices: [{ text: "Hello" }] });
  });

  it("should throw error if maxRetries is reached", async () => {
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        return HttpResponse.text("", { status: 500 });
      })
    );

    await expect(
      retry(testFunction, {
        maxRetries: 3,
        isErrorRetryable: (err) => {
          return err instanceof OpenAI.APIError && err.status === 500;
        },
      })
    ).rejects.toMatchObject({ status: 500 });
  });

  it("should retry on 500 but fail on 429", async () => {
    let called = 0;
    server.use(
      http.post("https://api.openai.com/v1/*", () => {
        called += 1;
        if (called === 1) {
          return HttpResponse.text("", { status: 500 });
        } else if (called === 2) {
          return HttpResponse.text("", { status: 429 });
        } else {
          return HttpResponse.json({ choices: [{ text: "Hello" }] });
        }
      })
    );
    const onErrorHandler = jest.fn<() => void>();

    await expect(
      retry(testFunction, {
        maxRetries: 3,
        isErrorRetryable: (err) => {
          return err instanceof OpenAI.APIError && err.status === 500;
        },
        onError: onErrorHandler,
      })
    ).rejects.toMatchObject({ status: 429 });
    expect(onErrorHandler).toHaveBeenCalledTimes(2);
  });
});
