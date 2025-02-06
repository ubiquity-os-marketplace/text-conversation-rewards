/* eslint-disable sonarjs/no-nested-functions */

import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import fs from "fs";
import { http, HttpResponse, passthrough } from "msw";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { Result } from "../src/types/results";
import { db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import contentEvaluatorResults from "./__mocks__/results/content-evaluator-results.json";
import dataPurgeResults from "./__mocks__/results/data-purge-result.json";
import formattingEvaluatorResults from "./__mocks__/results/formatting-evaluator-results.json";
import githubCommentResults from "./__mocks__/results/github-comment-results.json";
import githubCommentAltResults from "./__mocks__/results/github-comment-zero-results.json";
import permitGenerationResults from "./__mocks__/results/permit-generation-results.json";
import userCommentResults from "./__mocks__/results/user-comment-results.json";
import reviewIncentivizerResult from "./__mocks__/results/review-incentivizer-results.json";
import cfg from "./__mocks__/results/valid-configuration.json";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { CommentAssociation } from "../src/configuration/comment-types";
import { GitHubIssue } from "../src/github-types";
import { retry } from "../src/helpers/retry";
import OpenAI from "openai";

const issueUrl = process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquity-os/conversation-rewards/issues/5";

jest.unstable_mockModule("../src/helpers/web3", () => ({
  getErc20TokenSymbol() {
    return "WXDAI";
  },
}));

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
  config: cfg,
  logger: new Logs("debug"),
  octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    X25519_PRIVATE_KEY: process.env.X25519_PRIVATE_KEY,
  },
} as unknown as ContextPlugin;

jest.unstable_mockModule("@ubiquity-os/permit-generation", () => {
  const originalModule = jest.requireActual("@ubiquity-os/permit-generation") as object;

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
                return Promise.resolve(null);
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
const { PermitGenerationModule } = await import("../src/parser/permit-generation-module");
const { Processor } = await import("../src/parser/processor");
const { UserExtractorModule } = await import("../src/parser/user-extractor-module");
const { ReviewIncentivizerModule } = await import("../src/parser/review-incentivizer-module");

beforeAll(() => server.listen());
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

    jest.spyOn(ReviewIncentivizerModule.prototype, "getTripleDotDiffAsObject").mockImplementation(async () => {
      return {
        "test.txt": {
          addition: 50,
          deletion: 50,
        },
      };
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

  it("Should throw on a failed openai evaluation", async () => {
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
        diff: "```diff\n! Relevance / Comment length mismatch!\n```",
        level: "error",
        raw: "Relevance / Comment length mismatch!",
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

  it("Should generate permits", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new PermitGenerationModule(ctx),
    ];
    // This catches calls by getFastestRpc
    server.use(http.post("https://*", () => passthrough()));
    await processor.run(activity);
    const result = JSON.parse(processor.dump());
    expect(result).toEqual(permitGenerationResults);
  });

  it("Should generate GitHub comment", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
      new ReviewIncentivizerModule(ctx),
      new PermitGenerationModule(ctx),
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
  });

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
            type: CommentAssociation.ASSIGNEE,
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
        total: 45.168,
      },
    });
  });
});

describe("Retry", () => {
  const openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 });

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
