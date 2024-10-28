/* eslint-disable sonarjs/no-nested-functions */

import { drop } from "@mswjs/data";
import fs from "fs";
import { http, passthrough } from "msw";
import { IssueActivity } from "../src/issue-activity";
import { ContentEvaluatorModule } from "../src/parser/content-evaluator-module";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { FormattingEvaluatorModule } from "../src/parser/formatting-evaluator-module";
import { GithubCommentModule } from "../src/parser/github-comment-module";
import { PermitGenerationModule } from "../src/parser/permit-generation-module";
import { Processor } from "../src/parser/processor";
import { UserExtractorModule } from "../src/parser/user-extractor-module";
import "../src/parser/command-line";
import { parseGitHubUrl } from "../src/start";
import { ContextPlugin } from "../src/types/plugin-input";
import { db, db as mockDb } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import rewardSplitResult from "./__mocks__/results/reward-split.json";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

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

jest.mock("@actions/github", () => ({
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

jest.mock("@octokit/plugin-paginate-graphql", () => ({
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

jest.mock("@ubiquity-os/permit-generation", () => {
  const originalModule = jest.requireActual("@ubiquity-os/permit-generation");

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

jest.mock("../src/parser/command-line", () => {
  const cfg = require("./__mocks__/results/valid-configuration.json");
  const dotenv = require("dotenv");
  dotenv.config();
  return {
    stateId: 1,
    eventName: "issues.closed",
    authToken: process.env.GITHUB_TOKEN,
    ref: "",
    eventPayload: {
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
    settings: JSON.stringify(cfg),
  };
});

jest.mock("@supabase/supabase-js", () => {
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

jest.mock("../src/helpers/web3", () => ({
  getErc20TokenSymbol() {
    return "WXDAI";
  },
}));

jest.mock("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Rewards tests", () => {
  const issue = parseGitHubUrl(issueUrl);
  const activity = new IssueActivity({} as unknown as ContextPlugin, issue);

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
    const processor = new Processor({} as unknown as ContextPlugin);
    processor["_transformers"] = [
      new UserExtractorModule({} as unknown as ContextPlugin),
      new DataPurgeModule({} as unknown as ContextPlugin),
      new FormattingEvaluatorModule({} as unknown as ContextPlugin),
      new ContentEvaluatorModule({} as unknown as ContextPlugin),
      new PermitGenerationModule({} as unknown as ContextPlugin),
      new GithubCommentModule({} as unknown as ContextPlugin),
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
