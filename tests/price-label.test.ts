import { server } from "./__mocks__/node";
import { afterAll, afterEach, beforeAll, expect, it, jest } from "@jest/globals";
import cfg from "./__mocks__/results/valid-configuration.json";
import { ContextPlugin } from "../src/types/plugin-input";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

jest.unstable_mockModule("../src/helpers/label-price-extractor", () => {
  return {
    getSortedPrices: jest.fn(() => []),
  };
});

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
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
                  edges: [],
                },
              },
            },
          };
        },
      },
    };
  },
}));

const octokit = (await import("@ubiquity-os/plugin-sdk/octokit")).customOctokit;

describe("Price tests", () => {
  it("Should skip when no price label is set", async () => {
    const { run } = await import("../src/run");
    const result = await run({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
          number: 1,
          state_reason: "completed",
        },
        repository: {
          name: "conversation-rewards",
          owner: {
            login: "ubiquity-os",
          },
        },
      },
      config: cfg,
      logger: new Logs("debug"),
      octokit: new octokit({ auth: process.env.GITHUB_TOKEN }),
    } as unknown as ContextPlugin);
    expect(result).toEqual("No price label has been set. Skipping permit generation.");
  });
});
