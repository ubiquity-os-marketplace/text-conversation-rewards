import { drop } from "@mswjs/data";
import "../src/parser/command-line";
import { db } from "./__mocks__/db";
import dbSeed from "./__mocks__/db-seed.json";
import { server } from "./__mocks__/node";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

jest.mock("@actions/github", () => ({
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquibot/conversation-rewards",
      },
    },
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

jest.mock("../src/parser/command-line", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cfg = require("./__mocks__/results/valid-configuration.json");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
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
        number: 1,
        state_reason: "completed",
      },
      repository: {
        name: "conversation-rewards",
        owner: {
          login: "ubiquibot",
          id: 76412717,
        },
      },
    },
    settings: JSON.stringify(cfg),
  };
});

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
    // const patchMock = jest.fn(() => HttpResponse.json({}));
    // server.use(http.patch("https://api.github.com/repos/ubiquity/work.ubq.fi/issues/69", patchMock, { once: true }));
    jest.mock("../src/parser/processor", () => ({
      dump: jest.fn(() => "1".repeat(70000)),
      run: jest.fn(),
    }));
    const module = (await import("../src/index")) as unknown as { default: Promise<string> };
    const result = await module.default;
    expect(result).toEqual("All linked pull requests must be closed to generate rewards.");
  });
});
