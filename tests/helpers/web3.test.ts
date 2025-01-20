import { Erc20Wrapper, getEvmWallet, getErc20TokenContract, ERC20_ABI } from "../../src/helpers/web3";
import { Interface, parseUnits } from "ethers/lib/utils";
import { BigNumber, ethers } from "ethers";
import { describe, expect, it, jest } from "@jest/globals";

const mockContract = {
  balanceOf: jest.fn().mockReturnValue(BigNumber.from("1000")),
  symbol: jest.fn().mockReturnValue("WXDAI"),
  decimals: jest.fn().mockReturnValue(18),
  transfer: jest.fn().mockReturnValue("0xTransactionData"),
  estimateGas: {
    transfer: jest.fn().mockReturnValue(parseUnits("0.004", 18)),
  },
};

const mockWallet = {
  sendTransaction: jest.fn().mockReturnValue({ hash: "0xTransactionHash" }),
};

const erc20Wrapper = new Erc20Wrapper(mockContract as unknown as ethers.Contract);

describe("web3.ts", () => {
  it("Should return correct ERC20 token contract", async () => {
    const networkId = 100; // gnosis
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const contract = await getErc20TokenContract(networkId, tokenAddress);
    expect(contract.address).toEqual(tokenAddress);
    expect(contract.interface).toEqual(new Interface(ERC20_ABI));
  }, 120000);

  it("Should return correct ERC20 token data", async () => {
    const tokenSymbol = await erc20Wrapper.getSymbol();
    const tokenDecimals = await erc20Wrapper.getDecimals();
    const tokenBalance = await erc20Wrapper.getBalance("0xRecipient");
    expect(tokenSymbol).toEqual("WXDAI");
    expect(tokenDecimals).toEqual(18);
    expect(mockContract.balanceOf).toHaveBeenCalledWith("0xRecipient");
    expect(tokenBalance).toEqual(BigNumber.from("1000"));
  }, 120000);

  it("Should return correct wallet address", async () => {
    const networkId = 100; // gnosis
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const contract = await getErc20TokenContract(networkId, tokenAddress);
    const evmWallet = await getEvmWallet(
      "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e",
      contract.provider
    );
    const evmWalletAddress = await evmWallet.getAddress();
    expect(evmWalletAddress.toLowerCase()).toEqual("0x94d7a85efef179560f9b821cadd20056600fdb9d");
  }, 120000);

  it("Should return a valid tx", async () => {
    const tx = await erc20Wrapper.sendTransferTransaction(mockWallet as unknown as ethers.Wallet, "0xRecipient", 1000);
    expect(mockContract.transfer).toHaveBeenCalledWith("0xRecipient", parseUnits("1000", 18));
    expect(mockWallet.sendTransaction).toHaveBeenCalledWith("0xTransactionData");
    expect(tx.hash).toEqual("0xTransactionHash");
  }, 120000);

  it("Should estimates transfer fee correctly", async () => {
    const estimate = await erc20Wrapper.estimateTransferGas("0xfrom", "oxto", 100);
    expect(estimate).toEqual(parseUnits("0.004", 18));
  }, 120000);
});
