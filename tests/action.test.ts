/* eslint @typescript-eslint/no-var-requires: 0 */
import { http, HttpResponse } from "msw";
import { server } from "./__mocks__/node";

beforeAll(() => server.listen());
beforeEach(() => {
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
});
afterEach(() => {
  server.resetHandlers();
  jest.resetModules();
  jest.restoreAllMocks();
});
afterAll(() => server.close());

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
                        id: "PR_kwDOK87YcM5nHc9o",
                        title: "chore: add new shared evmPrivateKeyEncrypted",
                        number: 25,
                        url: "https://github.com/ubiquibot/comment-incentives/pull/25",
                        author: {
                          login: "gitcoindev",
                          id: 88761781,
                        },
                        repository: {
                          owner: {
                            login: "ubiquibot",
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

jest.mock("../src/helpers/get-comment-details", () => ({
  getMinimizedCommentStatus: jest.fn(),
}));

describe("Action tests", () => {
  it("Should skip when the issue is closed without the completed status", async () => {
    jest.mock("../src/parser/command-line", () => {
      const cfg: typeof import("./__mocks__/results/valid-configuration.json") = require("./__mocks__/results/valid-configuration.json");
      const dotenv = require("dotenv");
      dotenv.config();
      return {
        stateId: 1,
        eventName: "issues.closed",
        authToken: process.env.GITHUB_TOKEN,
        ref: "",
        eventPayload: {
          issue: {
            html_url: "https://github.com/ubiquibot/comment-incentives/issues/22",
            number: 1,
            state_reason: "not_planned",
          },
          repository: {
            name: "conversation-rewards",
            owner: {
              login: "ubiquibot",
            },
          },
        },
        settings: JSON.stringify(cfg),
      };
    });
    const run: typeof import("../src/index") = require("../src/index");
    await expect(run.default).resolves.toEqual("Issue was not closed as completed. Skipping.");
  });

  it("Should post comment network failure", async () => {
    jest.mock("../src/parser/command-line", () => {
      const cfg: typeof import("./__mocks__/results/valid-configuration.json") = require("./__mocks__/results/valid-configuration.json");
      const dotenv = require("dotenv");
      dotenv.config();
      return {
        stateId: 1,
        eventName: "issues.closed",
        authToken: process.env.GITHUB_TOKEN,
        ref: "",
        eventPayload: {
          issue: {
            html_url: "https://github.com/ubiquibot/comment-incentives/issues/22",
            number: 1,
            state_reason: "completed",
          },
          repository: {
            name: "conversation-rewards",
            owner: {
              login: "ubiquibot",
            },
          },
        },
        settings: JSON.stringify(cfg),
      };
    });
    [
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/events",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/comments",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/timeline",
    ].forEach((url) => {
      server.use(http.get(url, () => HttpResponse.json("", { status: 500 })));
    });
    const githubCommentModule: typeof import("../src/parser/github-comment-module") = require("../src/parser/github-comment-module");
    const spy = jest.spyOn(githubCommentModule.GithubCommentModule.prototype, "postComment");
    const run: typeof import("../src/index") = require("../src/index");
    await expect(run.default).resolves.toBeTruthy();
    expect(spy).toHaveBeenCalledWith(`\`\`\`diff
! Failed to run comment evaluation. Could not fetch issue data: HttpError
\`\`\`
<!--
https://github.com/ubiquibot/conversation-rewards/actions/runs/1
{
  \"logMessage\": {
    \"raw\": \"Could not fetch issue data: HttpError\",
    \"diff\": \"\`\`\`diff\\n! Could not fetch issue data: HttpError\\n\`\`\`\",
    \"type\": \"error\",
    \"level\": \"error\"
  },
  \"metadata\": {
    \"caller\": \"IssueActivity.error\"
  },
  \"caller\": \"error\"
}
-->`);
  }, 60000);

  it("Should link metadata to Github's comment", async () => {
    jest.mock("../src/run", () => ({
      run: jest.fn(() => {
        return Promise.reject("Some error");
      }),
    }));
    const githubCommentModule: typeof import("../src/parser/github-comment-module") = require("../src/parser/github-comment-module");
    const spy = jest.spyOn(githubCommentModule.GithubCommentModule.prototype, "postComment");
    const run: typeof import("../src/index") = require("../src/index");
    await expect(run.default).resolves.toEqual("Some error");
    expect(spy).toHaveBeenCalledWith(`\`\`\`diff
! Failed to run comment evaluation. Some error
\`\`\`
<!--
https://github.com/ubiquibot/conversation-rewards/actions/runs/1
{
  "message": "Some error",
  "caller": "error"
}
-->`);
  });

  it("Should retry to fetch on network failure", async () => {
    jest.mock("../src/parser/command-line", () => {
      const cfg: typeof import("./__mocks__/results/valid-configuration.json") = require("./__mocks__/results/valid-configuration.json");
      const dotenv = require("dotenv");
      dotenv.config();
      return {
        stateId: 1,
        eventName: "issues.closed",
        authToken: process.env.GITHUB_TOKEN,
        ref: "",
        eventPayload: {
          issue: {
            html_url: "https://github.com/ubiquibot/comment-incentives/issues/22",
            number: 1,
            state_reason: "not_planned",
          },
          repository: {
            name: "conversation-rewards",
            owner: {
              login: "ubiquibot",
            },
          },
        },
        settings: JSON.stringify(cfg),
      };
    });
    const { IssueActivity }: typeof import("../src/issue-activity") = require("../src/issue-activity");
    const { parseGitHubUrl }: typeof import("../src/start") = require("../src/start");
    // Fakes one crash per route retrieving the data. Should succeed on retry. Timeout for the test function needs
    // to be increased since it takes 10 seconds for a retry to happen.
    [
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/events",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/comments",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/timeline",
    ].forEach((url) => {
      server.use(http.get(url, () => HttpResponse.json("", { status: 500 }), { once: true }));
    });
    const issueUrl = process.env.TEST_ISSUE_URL ?? "https://github.com/ubiquibot/comment-incentives/issues/22";
    const issue = parseGitHubUrl(issueUrl);
    const activity = new IssueActivity(issue);
    await activity.init();
    expect(activity.self).toBeTruthy();
    expect(activity.linkedReviews.length).toBeGreaterThan(0);
    expect(activity.comments.length).toBeGreaterThan(0);
    expect(activity.events.length).toBeGreaterThan(0);
  }, 60000);
});
