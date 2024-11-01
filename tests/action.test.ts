import { afterAll, afterEach, beforeAll, beforeEach, describe, jest, it } from "@jest/globals";
import { http, HttpResponse } from "msw";
import { ContextPlugin } from "../src/types/plugin-input";
import { server } from "./__mocks__/node";

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

jest.unstable_mockModule("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

describe("Action tests", () => {
  it("Should skip when the issue is closed without the completed status", async () => {
    jest.unstable_mockModule("../src/parser/command-line", async () => {
      const cfg: typeof import("./__mocks__/results/valid-configuration.json") = await import(
        "./__mocks__/results/valid-configuration.json"
      );
      const dotenv = await import("dotenv");
      dotenv.config();
      return {
        stateId: 1,
        eventName: "issues.closed",
        authToken: process.env.GITHUB_TOKEN,
        ref: "",
        eventPayload: {
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
        settings: JSON.stringify(cfg),
      };
    });
    const run = await import("../src/index");
    await expect(run.default).resolves.toEqual("Issue was not closed as completed. Skipping.");
  });

  it("Should post comment network failure", async () => {
    jest.unstable_mockModule("../src/parser/command-line", async () => {
      const cfg: typeof import("./__mocks__/results/valid-configuration.json") = await import(
        "./__mocks__/results/valid-configuration.json"
      );
      const dotenv = await import("dotenv");
      dotenv.config();
      return {
        stateId: 1,
        eventName: "issues.closed",
        authToken: process.env.GITHUB_TOKEN,
        ref: "",
        eventPayload: {
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
        settings: JSON.stringify(cfg),
      };
    });
    [
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/events",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/comments",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/timeline",
    ].forEach((url) => {
      server.use(http.get(url, () => HttpResponse.json("", { status: 500 })));
    });
    const githubCommentModule: typeof import("../src/parser/github-comment-module") = await import(
      "../src/parser/github-comment-module"
    );
    const spy = jest.spyOn(githubCommentModule.GithubCommentModule.prototype, "postComment");
    const run: typeof import("../src/index") = await import("../src/index");
    await expect(run.default).resolves.toBeTruthy();
    expect(spy).toHaveBeenCalledWith(`\`\`\`diff
! Failed to run comment evaluation. Could not fetch issue data: HttpError
\`\`\`
<!--
https://github.com/ubiquity-os/conversation-rewards/actions/runs/1
{
  "logMessage": {
    "raw": "Could not fetch issue data: HttpError",
    "diff": "\`\`\`diff\\n! Could not fetch issue data: HttpError\\n\`\`\`",
    "type": "error",
    "level": "error"
  },
  "metadata": {
    "caller": "IssueActivity.error"
  },
  "caller": "error"
}
-->`);
  }, 60000);

  it("Should link metadata to Github's comment", async () => {
    jest.unstable_mockModule("../src/run", () => ({
      run: jest.fn(() => {
        return Promise.reject("Some error");
      }),
    }));
    const githubCommentModule: typeof import("../src/parser/github-comment-module") = await import(
      "../src/parser/github-comment-module"
    );
    const spy = jest.spyOn(githubCommentModule.GithubCommentModule.prototype, "postComment");
    const run: typeof import("../src/index") = await import("../src/index");
    await expect(run.default).resolves.toEqual("Some error");
    expect(spy).toHaveBeenCalledWith(`\`\`\`diff
! Failed to run comment evaluation. Some error
\`\`\`
<!--
https://github.com/ubiquity-os/conversation-rewards/actions/runs/1
{
  "message": "Some error",
  "caller": "error"
}
-->`);
  });

  it("Should retry to fetch on network failure", async () => {
    jest.unstable_mockModule("../src/parser/command-line", async () => {
      const cfg: typeof import("./__mocks__/results/valid-configuration.json") = await import(
        "./__mocks__/results/valid-configuration.json"
      );
      const dotenv = await import("dotenv");
      dotenv.config();
      return {
        stateId: 1,
        eventName: "issues.closed",
        authToken: process.env.GITHUB_TOKEN,
        ref: "",
        eventPayload: {
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
        settings: JSON.stringify(cfg),
      };
    });
    const { IssueActivity } = await import("../src/issue-activity");
    const { parseGitHubUrl } = await import("../src/start");
    // Fakes one crash per route retrieving the data. Should succeed on retry. Timeout for the test function needs
    // to be increased since it takes 10 seconds for a retry to happen.
    [
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/events",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/comments",
      "https://api.github.com/repos/ubiquity-os/comment-incentives/issues/22/timeline",
    ].forEach((url) => {
      server.use(http.get(url, () => HttpResponse.json("", { status: 500 }), { once: true }));
    });
    const issueUrl = parseGitHubUrl(
      process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquity-os/comment-incentives/issues/22"
    );
    const activity = new IssueActivity({} as unknown as ContextPlugin, issueUrl);
    await activity.init();
    expect(activity.self).toBeTruthy();
    expect(activity.linkedReviews.length).toBeGreaterThan(0);
    expect(activity.comments.length).toBeGreaterThan(0);
    expect(activity.events.length).toBeGreaterThan(0);
  }, 60000);
});
