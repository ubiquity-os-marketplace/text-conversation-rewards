import { customOctokit as Octokit } from "@ubiquity-os/plugin-sdk/octokit";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { http, HttpResponse } from "msw";
import { ContextPlugin } from "../src/types/plugin-input";
import { server } from "./__mocks__/node";
import cfg from "./__mocks__/results/valid-configuration.json";
import "./helpers/permit-mock";

beforeAll(() => server.listen());
beforeEach(() => {
  mock.module("@actions/github", () => ({
    default: {},
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
  mock.restore();
});
afterAll(() => server.close());

mock.module("../src/data-collection/collect-linked-pulls", () => ({
  collectLinkedMergedPulls: mock(() => [
    {
      id: "PR_kwDOK87YcM5nHc9o",
      title: "chore: add new shared evmPrivateKeyEncrypted",
      number: 25,
      url: "https://github.com/ubiquity-os/comment-incentives/pull/25",
      author: {
        login: "gitcoindev",
        id: 88761781,
      },
      state: "MERGED",
      repository: {
        owner: {
          login: "ubiquity-os",
        },
        name: "comment-incentives",
      },
    },
  ]),
}));

mock.module("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: mock(),
}));

describe("Action tests", () => {
  it("Should skip when the issue is closed without the completed status", async () => {
    const { run } = await import("../src/run");
    expect(
      run({
        eventName: "issues.closed",
        payload: {
          issue: {
            html_url: "https://github.com/ubiquity-os/comment-incentives/issues/22",
            number: 1,
            state_reason: "not_planned",
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
        },
        config: cfg,
        logger: new Logs("debug"),
        octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
        commentHandler: {
          postComment: mock(),
        },
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
        octokit: new Octokit({ auth: process.env.GITHUB_TOKEN }),
        command: null,
        commentHandler: {
          postComment: mock(),
        },
      } as unknown as ContextPlugin)
    ).rejects.toMatchObject({
      logMessage: {
        diff: "> [!CAUTION]\n> Could not fetch issue data: HttpError",
        level: "error",
        raw: "Could not fetch issue data: HttpError",
        type: "error",
      },
    });
  }, 60000);
});
