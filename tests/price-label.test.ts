/* eslint-disable sonarjs/no-nested-functions */

import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from "bun:test";
import { ContextPlugin } from "../src/types/plugin-input";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  mock.restore();
});
afterAll(() => server.close());

describe("Price tests", () => {
  it("Should skip when no price label is set", async () => {
    mock.module("../src/helpers/label-price-extractor", () => {
      return {
        getSortedPrices: mock(() => []),
        getTaskReward: mock(() => 0),
      };
    });

    mock.module("../src/helpers/get-comment-details", () => ({
      getMinimizedCommentStatus: mock(),
    }));

    mock.module("@octokit/plugin-paginate-graphql", () => ({
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
    const { run } = await import("../src/run");

    const result = await run({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
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
          },
        },
        sender: {
          login: "0x4007",
        },
      },
      config: cfg,
      logger: new Logs("debug"),
      octokit: new octokit({ auth: process.env.GITHUB_TOKEN }),
      commentHandler: {
        postComment: mock(),
      },
    } as unknown as ContextPlugin);

    expect(result).toEqual("No price label has been set. Skipping permit generation.");
  });

  it("Should throw a warning when a Price: 0 label is detected", async () => {
    mock.module("../src/helpers/label-price-extractor", () => {
      return {
        getSortedPrices: mock(() => [0]),
        getTaskReward: mock(() => 0),
      };
    });

    mock.module("../src/helpers/get-comment-details", () => ({
      getMinimizedCommentStatus: mock(),
    }));

    mock.module("@octokit/plugin-paginate-graphql", () => ({
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
    const { run } = await import("../src/run");

    const mockLogger = new Logs("debug");
    const mockWarn = spyOn(mockLogger, "warn").mockImplementation((message) => {
      return {
        logMessage: {
          raw: message,
          diff: message,
          level: "warn",
          type: "warn",
        },
      };
    });

    const mockCommentHandler = {
      postComment: mock(),
    };

    expect(
      run({
        eventName: "issues.closed",
        payload: {
          issue: {
            html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
            number: 1,
            state_reason: "completed",
            assignees: [
              {
                id: 1,
                login: "gentlementlegen",
              },
            ],
            labels: [{ name: "Price: 0 USD" }],
          },
          repository: {
            name: "conversation-rewards",
            owner: {
              login: "ubiquity-os",
            },
          },
          sender: {
            login: "0x4007",
          },
        },
        config: cfg,
        logger: mockLogger,
        octokit: new octokit({ auth: process.env.GITHUB_TOKEN }),
        commentHandler: mockCommentHandler,
      } as unknown as ContextPlugin)
    ).rejects.toMatchObject({
      logMessage: {
        raw: "No rewards have been distributed for this task because it was explicitly marked with a Price: 0 label.",
      },
    });

    expect(mockWarn).toHaveBeenCalledWith(
      "No rewards have been distributed for this task because it was explicitly marked with a Price: 0 label."
    );

    expect(mockCommentHandler.postComment).not.toHaveBeenCalled();
  });
});
