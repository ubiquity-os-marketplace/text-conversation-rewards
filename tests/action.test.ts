/* eslint @typescript-eslint/no-var-requires: 0 */
import "../src/parser/command-line";
import { run } from "../src/run";
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
        html_url: "https://ubiquibot/conversation-rewards",
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
https://ubiquibot/conversation-rewards/actions/runs/1
{
  "message": "Some error",
  "caller": "call"
}
-->`);
  });
});
