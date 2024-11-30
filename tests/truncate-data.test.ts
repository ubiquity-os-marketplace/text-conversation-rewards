/* eslint-disable sonarjs/no-nested-functions */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
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
  },
}));

jest.unstable_mockModule("@ubiquity-os/plugin-sdk", () => ({
  postComment: jest.fn(),
}));

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
                        id: "PR_kwDOKzVPS85zXUok",
                        title: "fix: add state to sorting manager for bottom and top 2",
                        number: 71,
                        url: "https://github.com/ubiquity/work.ubq.fi/pull/71",
                        state: "MERGED",
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

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Payload truncate tests", () => {
  beforeEach(async () => {
    drop(db);
    for (const table of Object.keys(dbSeed)) {
      const tableName = table as keyof typeof dbSeed;
      for (const row of dbSeed[tableName]) {
        db[tableName].create(row);
      }
    }
  });

  it("Should truncate the returned data if the payload is too large", async () => {
    jest.unstable_mockModule("../src/parser/processor", () => ({
      Processor: jest.fn(() => ({
        dump: jest.fn(() =>
          JSON.stringify({
            user: {
              total: 1,
              userId: "1",
              task: "1",
              permitUrl: "http",
              comments: "1".repeat(70000),
            },
          })
        ),
        run: jest.fn(),
      })),
    }));
    jest.unstable_mockModule("../src/issue-activity", () => {
      return { IssueActivity: jest.fn(() => ({ init: jest.fn() })) };
    });
    const module = await import("../src/run");
    const result = await module.run({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: issueUrl,
          number: 1,
          state_reason: "completed",
        },
        repository: {
          name: "conversation-rewards",
          owner: {
            login: "ubiquity-os",
            id: 76412717,
          },
        },
      },
      octokit: {
        graphql: {
          paginate: jest.fn(() => ({
            repository: {
              issue: {
                closedByPullRequestsReferences: {
                  edges: [
                    {
                      node: {
                        id: "PR_kwDOKzVPS85zXUok",
                        title: "fix: add state to sorting manager for bottom and top 2",
                        number: 71,
                      },
                    },
                  ],
                },
              },
            },
          })),
        },
      },
      logger: new Logs("debug"),
      config: {
        ...cfg,
        incentives: {
          ...cfg.incentives,
          requirePriceLabel: false,
        },
      },
    } as unknown as ContextPlugin);
    const expectedResult = {
      user: {
        permitUrl: "http",
        task: "1",
        total: 1,
        userId: "1",
      },
    };
    expect(result).toEqual(expectedResult);
  });
});
