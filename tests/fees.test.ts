import { GithubCommentModule } from "../src/parser/github-comment-module";
import { Result } from "../src/parser/processor";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

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
        html_url: issueUrl,
        number: 69,
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
    settings: JSON.stringify(cfg),
  };
});

jest.mock("../src/helpers/web3", () => ({
  getErc20TokenSymbol() {
    return "WXDAI";
  },
}));

jest.mock("@actions/github", () => ({
  context: {
    runId: "1",
    payload: {
      repository: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards",
      },
    },
    sha: "1234",
  },
}));

describe("GithubCommentModule Fee Tests", () => {
  let githubCommentModule: GithubCommentModule;

  beforeEach(() => {
    githubCommentModule = new GithubCommentModule();
  });

  it("should display the fee message when a fee percentage is applied", async () => {
    const result: Result = {
      "ubiquity-os": {
        comments: [],
        total: 100, // Example value
        task: {
          reward: 50, // Example value
          multiplier: 1.5, // Example value
        },
        feeRate: 0.2, // This implies a 5% fee
        permitUrl: "https://pay.ubq.fi", // Example URL
        userId: 12345, // Example user ID
        evaluationCommentHtml: "",
      },
    };

    jest.spyOn(githubCommentModule, "_generateHtml");

    const bodyContent = await githubCommentModule.getBodyContent(result);

    expect(bodyContent).toEqual(
      '<details><summary><b><h3>&nbsp;<a href="https://pay.ubq.fi" target="_blank" rel="noopener">[ 100 WXDAI ]</a>&nbsp;</h3><h6>@ubiquity-os</h6></b></summary><h6>⚠️ 20% fee rate has been applied. Consider using the<a href="https://dao.ubq.fi/dollar" target="_blank" rel="noopener">Ubiquity Dollar</a>for no fees.</h6><h6>Contributions Overview</h6><table><thead><tr><th>View</th><th>Contribution</th><th>Count</th><th>Reward</th></tr></thead><tbody><tr><td>Issue</td><td>Task</td><td>1.5</td><td>50</td></tr></tbody></table><h6>Conversation Incentives</h6><table><thead><tr><th>Comment</th><th>Formatting</th><th>Relevance</th><th>Reward</th></tr></thead><tbody></tbody></table></details>\n' +
        "<!-- Ubiquity - GithubCommentModule - GithubCommentModule._callee$ - 1234\n" +
        "{\n" +
        '  "workflowUrl": "undefined/actions/runs/NaN",\n' +
        '  "output": {\n' +
        '    "ubiquity-os": {\n' +
        '      "comments": [],\n' +
        '      "total": 100,\n' +
        '      "task": {\n' +
        '        "reward": 50,\n' +
        '        "multiplier": 1.5\n' +
        "      },\n" +
        '      "feeRate": 0.2,\n' +
        '      "permitUrl": "https://pay.ubq.fi",\n' +
        '      "userId": 12345\n' +
        "    }\n" +
        "  }\n" +
        "}\n" +
        "-->"
    );
  });
});
