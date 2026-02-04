import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { IssueActivity } from "../src/issue-activity";
import { ContextPlugin } from "../src/types/plugin-input";
import { Result } from "../src/types/results";
import cfg from "./__mocks__/results/valid-configuration.json";
import { mockWeb3Module } from "./helpers/web3-mocks";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";

mockWeb3Module();

jest.mock("@actions/github", () => ({
  default: {},
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

describe("GithubCommentModule Simplification Rounding", () => {
  let githubCommentModule: InstanceType<typeof import("../src/parser/github-comment-module").GithubCommentModule>;

  beforeEach(async () => {
    const { GithubCommentModule } = await import("../src/parser/github-comment-module");
    githubCommentModule = new GithubCommentModule({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: issueUrl,
          number: 69,
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
            id: 76412717,
          },
        },
      },
      config: cfg,
    } as unknown as ContextPlugin);
  });

  it("should not display floating point noise in Task Simplification total", async () => {
    const result: Result = {
      gentlementlegen: {
        total: 1.44,
        userId: 123,
        permitUrl: "https://pay.ubq.fi",
        payoutMode: "permit",
        walletAddress: "0x1",
        evaluationCommentHtml: "<p>None</p>",
        simplificationReward: {
          url: "https://github.com/acme/widget/pull/52#issue-2697249352",
          files: [
            { fileName: "a.ts", reward: 0.15, additions: 0, deletions: 19 },
            { fileName: "b.ts", reward: 0.03, additions: 0, deletions: 8 },
            { fileName: "c.ts", reward: 0.13, additions: 0, deletions: 24 },
            { fileName: "d.ts", reward: 0.14, additions: 0, deletions: 14 },
            { fileName: "e.ts", reward: 0.08, additions: 0, deletions: 11 },
            { fileName: "f.ts", reward: 0.02, additions: 0, deletions: 4 },
            { fileName: "g.ts", reward: 0.78, additions: 0, deletions: 79 },
            { fileName: "h.ts", reward: 0.01, additions: 0, deletions: 82 },
            { fileName: "i.ts", reward: 0.1, additions: 0, deletions: 23 },
          ],
        },
      },
    };

    const bodyContent = await githubCommentModule.getBodyContent({} as unknown as IssueActivity, result);

    expect(bodyContent.raw).toContain("<td>Task Simplification</td><td>1</td><td>1.44</td>");
    expect(bodyContent.raw).not.toContain("1.4400000000000002");
  });
});
