import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ContextPlugin, RewardSettings } from "../src/types/plugin-input";
import cfg from "./__mocks__/results/valid-configuration.json";
import { mockWeb3Module } from "./helpers/web3-mocks";

const web3Mocks = mockWeb3Module();

type TokenSymbolReader = {
  _getTokenSymbolForConfig(config: RewardSettings): Promise<string>;
};

describe("GithubCommentModule token symbol lookup", () => {
  let githubCommentModule: TokenSymbolReader;

  beforeEach(async () => {
    jest.clearAllMocks();

    const { GithubCommentModule } = await import("../src/parser/github-comment-module");
    githubCommentModule = new GithubCommentModule({
      eventName: "issues.closed",
      payload: {},
      config: cfg,
      logger: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      },
    } as unknown as ContextPlugin) as unknown as TokenSymbolReader;
  });

  it("explains when the configured token is not available on the selected network", async () => {
    const rewards = {
      ...(cfg.rewards as RewardSettings),
      evmNetworkId: 1,
    };

    const getSymbol = web3Mocks.Erc20Wrapper.getSymbol as unknown as {
      mockRejectedValueOnce(error: Error): void;
    };
    getSymbol.mockRejectedValueOnce(new Error('call revert exception (method="symbol()", data="0x")'));

    await expect(githubCommentModule._getTokenSymbolForConfig(rewards)).rejects.toThrow(
      "Token 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d was not found on network ID 1"
    );
  });
});
