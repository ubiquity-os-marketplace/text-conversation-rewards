import { drop } from "@mswjs/data";
import { paginateGraphQL } from "@octokit/plugin-paginate-graphql";
import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { http, HttpResponse } from "msw";
import "../src/parser/command-line";
import { ContextPlugin } from "../src/types/plugin-input";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
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
                        id: "PR_kwDOKzVPS85zXUoj",
                        title: "fix: add state to sorting manager for bottom and top",
                        number: 70,
                        url: "https://github.com/ubiquity/work.ubq.fi/pull/70",
                        state: "OPEN",
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

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: jest.fn(() => [
    {
      id: "PR_kwDOKzVPS85zXUoj",
      title: "fix: add state to sorting manager for bottom and top",
      number: 70,
      url: "https://github.com/ubiquity/work.ubq.fi/pull/70",
      state: "OPEN",
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
    {
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
  ]),
}));

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("Pre-check tests", () => {
  beforeEach(async () => {
    drop(db);
    for (const table of Object.keys(dbSeed)) {
      const tableName = table as keyof typeof dbSeed;
      for (const row of dbSeed[tableName]) {
        db[tableName].create(row);
      }
    }
  });

  it("Should reopen the issue and not generate rewards if linked pull-requests are still open", async () => {
    const patchMock = jest.fn(() => HttpResponse.json({}));
    server.use(http.patch("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69", patchMock, { once: true }));
    const { run } = await import("../src/run");
    const result = await run({
      stateId: 1,
      eventName: "issues.closed",
      authToken: process.env.GITHUB_TOKEN,
      ref: "",
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
      config: cfg,
      logger: new Logs("debug"),
      octokit: new (Octokit.plugin(paginateGraphQL).defaults({ auth: process.env.GITHUB_TOKEN }))(),
    } as unknown as ContextPlugin);
    expect(result).toEqual("All linked pull requests must be closed to generate rewards.");
    expect(patchMock).toHaveBeenCalled();
  });
});
