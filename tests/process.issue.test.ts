/* eslint-disable sonarjs/no-nested-functions */

import fs from "fs";
import { http, passthrough } from "msw";
import { IssueActivity } from "../src/issue-activity";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { GithubCommentModule } from "../src/parser/github-comment-module";
import { PermitGenerationModule } from "../src/parser/permit-generation-module";
import { Processor, Result } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import { parseGitHubUrl } from "../src/start";
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
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ContextPlugin } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { Octokit } from "@octokit/rest";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";

const issueUrl = process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquity-os/conversation-rewards/issues/5";

jest.unstable_mockModule("../src/helpers/web3", () => ({
  getErc20TokenSymbol() {
    return "WXDAI";
  },
}));

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

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

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

jest.unstable_mockModule("@octokit/plugin-paginate-graphql", () => ({
  paginateGraphQL() {
    return {
      graphql: {
        paginate() {
          return {
            repository: {
              issue: {
                closedByPullRequestsReferences: {
                  edges: [
                    {
                      node: {
                        id: "PR_kwDOLUK0B85soGlu",
                        title: "feat: github comment generation and posting",
                        number: 12,
                        url: "https://github.com/ubiquity-os/conversation-rewards/pull/12",
                        author: {
                          login: "gentlementlegen",
                          id: 9807008,
                        },
                        repository: {
                          owner: {
                            login: "ubiquity-os",
                          },
                          name: "conversation-rewards",
                        },
                      },
                    },
                  ],
                },
              },
            },
          };
        },
      },
    };
  },
}));

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
        diff: "```diff\n- Relevance / Comment length mismatch!\n```",
        level: "fatal",
        raw: "Relevance / Comment length mismatch!",
        type: "fatal",
      },
    });
  });

  it("Should generate permits", async () => {
    const processor = new Processor(ctx);
    processor["_transformers"] = [
      new UserExtractorModule(ctx),
      new DataPurgeModule(ctx),
      new FormattingEvaluatorModule(ctx),
      new ContentEvaluatorModule(ctx),
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
    const postBody = await githubCommentModule.getBodyContent(githubCommentAltResults as unknown as Result);
    expect(postBody).not.toContain("whilefoo");
  });

  it("Should do a full run", async () => {
    const module = (await import("../src/index")) as unknown as { default: Promise<string> };
    const result = await module.default;
    expect(result).toBeTruthy();
  });
});
