import { describe, expect, it } from "@jest/globals";
import { createTokenSymbolLookupError } from "../src/parser/github-comment-module";
import type { RewardSettings } from "../src/types/plugin-input";

const rewardSettings: RewardSettings = {
  evmNetworkId: 1,
  evmPrivateEncrypted: "encrypted-key",
  erc20RewardToken: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
};

describe("createTokenSymbolLookupError", () => {
  it("explains token and network when symbol lookup reverts", () => {
    const error = Object.assign(new Error('call revert exception (method="symbol()")'), {
      code: "CALL_EXCEPTION",
      method: "symbol()",
    });

    expect(createTokenSymbolLookupError(error, rewardSettings)).toEqual(
      new Error(
        "Token 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d was not found on network ID 1. " +
          "The smart contract does not exist on this network."
      )
    );
  });

  it("preserves unrelated lookup errors", () => {
    const error = new Error("RPC endpoint unavailable");

    expect(createTokenSymbolLookupError(error, rewardSettings)).toBe(error);
  });
});
