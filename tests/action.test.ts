/* eslint @typescript-eslint/no-var-requires: 0 */
import "../src/parser/command-line";
import { http, HttpResponse } from "msw";
import { IssueActivity } from "../src/issue-activity";
import { run } from "../src/run";
import { parseGitHubUrl } from "../src/start";
import { server } from "./__mocks__/node";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

describe("Action tests", () => {
  it("Should skip when the issue is closed without the completed status", async () => {
    const result = await run();
    expect(result).toEqual("Issue was not closed as completed. Skipping.");
  });

  it("Should link metadata to Github's comment", async () => {
    jest.mock("../src/run", () => ({
      run: jest.fn(() => {
        return Promise.reject("Some error");
      }),
    }));
    const githubCommentModule = require("../src/parser/github-comment-module");
    const spy = jest.spyOn(githubCommentModule.GithubCommentModule.prototype, "postComment");
    const run = (await import("../src/index")) as unknown as { default: Promise<string> };
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
    const issueUrl = process.env.TEST_ISSUE_URL || "https://github.com/ubiquibot/comment-incentives/issues/22";
    const issue = parseGitHubUrl(issueUrl);
    const activity = new IssueActivity(issue);
    await activity.init();
    expect(activity.self).toBeTruthy();
    expect(activity.linkedReviews.length).toBeGreaterThan(0);
    expect(activity.comments.length).toBeGreaterThan(0);
    expect(activity.events.length).toBeGreaterThan(0);
  }, 60000);

  it("Should post comment network failure", async () => {
    jest.unmock("../src/run");
    [
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/events",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/comments",
      "https://api.github.com/repos/ubiquibot/comment-incentives/issues/22/timeline",
    ].forEach((url) => {
      server.use(http.get(url, () => HttpResponse.json("", { status: 500 })));
    });
    const githubCommentModule = require("../src/parser/github-comment-module");
    const spy = jest.spyOn(githubCommentModule.GithubCommentModule.prototype, "postComment");
    const run = (await import("../src/index")) as unknown as { default: Promise<string> };
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
  }, 60000);
});
