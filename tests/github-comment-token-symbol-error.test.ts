import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ContextPlugin } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";
import { mockWeb3Module } from "./helpers/web3-mocks";

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

describe("GithubCommentModule token symbol errors", () => {
  let githubCommentModule: InstanceType<typeof import("../src/parser/github-comment-module").GithubCommentModule>;
  const logger = {
    error: jest.fn((message: string, _context?: unknown) => new Error(message)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const { GithubCommentModule } = await import("../src/parser/github-comment-module");
    githubCommentModule = new GithubCommentModule({
      eventName: "issues.closed",
      payload: {
        issue: {
          html_url: "https://github.com/ubiquity/work.ubq.fi/issues/271",
          number: 271,
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
      config: cfg,
      logger,
    } as unknown as ContextPlugin);
  });

  it("should explain when the configured reward token is missing on the configured network", async () => {
    web3Mocks.Erc20Wrapper.getSymbol.mockImplementationOnce(async () => {
      throw new Error("CALL_EXCEPTION: missing revert data");
    });

    await expect(
      (githubCommentModule as unknown as { _getTokenDisplayForUser(username: string): Promise<unknown> })._getTokenDisplayForUser("0x4007")
    ).rejects.toThrow("does not appear to exist on network ID 100");

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Verify the token address and configured network ID."),
      expect.objectContaining({ error: expect.any(Error) })
    );
  });
});
