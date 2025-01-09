import { BigNumber } from "ethers";
import {
  getErc20TokenSymbol,
  getErc20TokenDecimals,
  getFundingWalletBalance,
  getFundingWallet,
  getErc20TokenContract,
  ERC20_ABI,
} from "../../src/helpers/web3";
import { Interface } from "ethers/lib/utils";

describe("web3.ts", () => {
  describe("getERC20TokenSymbol()", () => {
    it("Should return ERC20 token symbol", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const tokenSymbol = await getErc20TokenSymbol(networkId, tokenAddress);
      expect(tokenSymbol).toEqual("WXDAI");
    }, 120000);
  });
  describe("getErc20TokenDecimals()", () => {
    it("Should return ERC20 token decimals", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const tokenDecimals = await getErc20TokenDecimals(networkId, tokenAddress);
      expect(tokenDecimals).toEqual(18);
    }, 120000);
  });
  describe("getFundingWalletBalance()", () => {
    it("Should return ERC20 token balance of the funding wallet", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const tokenBalance: BigNumber = await getFundingWalletBalance(
        networkId,
        tokenAddress,
        "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e"
      );
      expect(tokenBalance.isZero()).toEqual(true);
    }, 120000);
  });
  describe("getFundingWallet()", () => {
    it("Should return ERC20 token decimals", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const contract = await getErc20TokenContract(networkId, tokenAddress);
      const fundingWallet = await getFundingWallet(
        "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e",
        contract.provider
      );
      const fundingWalledAddress = await fundingWallet.getAddress();
      expect(fundingWalledAddress.toLowerCase()).toEqual("0x94d7a85efef179560f9b821cadd20056600fdb9d");
    }, 120000);
  });

  describe("getErc20TokenContract()", () => {
    it("Should return ERC20 token contract", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const contract = await getErc20TokenContract(networkId, tokenAddress);
      expect(contract.address).toEqual(tokenAddress);
      expect(contract.interface).toEqual(new Interface(ERC20_ABI));
    }, 120000);
  });
});
