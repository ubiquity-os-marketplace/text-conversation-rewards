import { getErc20TokenSymbol } from "../../src/helpers/web3";

describe("web3.ts", () => {
  describe("getERC20TokenSymbol()", () => {
    it("Should return ERC20 token symbol", async () => {
      // const networkId = 100; // gnosis
      // const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const tokenSymbol = await getErc20TokenSymbol();
      expect(tokenSymbol).toEqual("XP");
    }, 120000);
  });
});
