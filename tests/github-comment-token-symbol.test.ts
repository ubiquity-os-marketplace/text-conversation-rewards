import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { IssueActivity } from "../src/issue-activity";
import { ContextPlugin } from "../src/types/plugin-input";
import { Result } from "../src/types/results";
import cfg from "./__mocks__/results/valid-configuration.json";
import { mockWeb3Module } from "./helpers/web3-mocks";

const issueUrl = "https://github.com/ubiquity/work.ubq.fi/issues/69";
const wxdaiAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d";
const web3Mocks = mockWeb3Module();

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

describe("GithubCommentModule token symbol lookup", () => {
  let githubCommentModule: InstanceType<typeof import("../src/parser/github-comment-module").GithubCommentModule>;

  beforeEach(async () => {
    jest.clearAllMocks();
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
      config: {
        ...cfg,
        rewards: {
          ...cfg.rewards,
          erc20RewardToken: wxdaiAddress,
          evmNetworkId: 1,
        },
      },
    } as unknown as ContextPlugin);
  });

  it("throws a clear error when the reward token contract is missing on the configured network", async () => {
    const tokenLookupError = Object.assign(new Error("call revert exception"), { code: "CALL_EXCEPTION" });
    web3Mocks.Erc20Wrapper.getSymbol.mockImplementationOnce(() => Promise.reject(tokenLookupError));

    const result: Result = {
      gentlementlegen: {
        total: 10,
        userId: 123,
        permitUrl: "https://pay.ubq.fi",
        payoutMode: "permit",
        walletAddress: "0x1",
        evaluationCommentHtml: "<p>None</p>",
      },
    };

    await expect(githubCommentModule.getBodyContent({} as unknown as IssueActivity, result)).rejects.toThrow(
      `This token ${wxdaiAddress} was not found on network ID 1`
    );
  });
});
