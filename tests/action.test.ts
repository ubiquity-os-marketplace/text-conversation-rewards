import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { http, HttpResponse } from "msw";
import { ContextPlugin } from "../src/types/plugin-input";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";

beforeAll(() => server.listen());
beforeEach(() => {
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
});
afterEach(() => {
  server.resetHandlers();
  jest.resetModules();
  jest.restoreAllMocks();
});
afterAll(() => server.close());

jest.unstable_mockModule("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: jest.fn(() => [
    {
      id: "PR_kwDOK87YcM5nHc9o",
      title: "chore: add new shared evmPrivateKeyEncrypted",
      number: 25,
      url: "https://github.com/ubiquity-os/comment-incentives/pull/25",
      author: {
        login: "gitcoindev",
        id: 88761781,
      },
      repository: {
        owner: {
          login: "ubiquity-os",
        },
        name: "comment-incentives",
      },
    },
  ]),
}));

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

describe("Action tests", () => {
  it("Should skip when the issue is closed without the completed status", async () => {
    const { run } = await import("../src/run");
    await expect(
      run({
        eventName: "issues.closed",
        payload: {
          issue: {
            html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
            number: 1,
            state_reason: "not_planned",
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
        octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
      } as unknown as ContextPlugin)
    ).resolves.toEqual("Issue was not closed as completed. Skipping.");
  });

  it("Should post comment network failure", async () => {
    [
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/events",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/comments",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/timeline",
    ].forEach((url) => {
      server.use(http.get(url, () => HttpResponse.json("", { status: 500 })));
    });
    const { run } = await import("../src/run");
    await expect(
      run({
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
        octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
        command: null,
      } as unknown as ContextPlugin)
    ).rejects.toEqual({
      logMessage: {
        diff: "```diff\n! Could not fetch issue data: HttpError\n```",
        level: "error",
        raw: "Could not fetch issue data: HttpError",
        type: "error",
      },
      metadata: {
        caller: "IssueActivity.error",
      },
    });
  }, 60000);
});
