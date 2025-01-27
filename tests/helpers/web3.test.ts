import { Erc20Wrapper, getEvmWallet, getContract, ERC20_ABI, Permit2Wrapper } from "../../src/helpers/web3";
import { Interface, parseUnits } from "ethers/lib/utils";
import { BigNumber, ethers, utils } from "ethers";
import { describe, expect, it, jest } from "@jest/globals";

const mockErc20Contract = {
  balanceOf: jest.fn().mockReturnValue(BigNumber.from("1000")),
  symbol: jest.fn().mockReturnValue("WXDAI"),
  decimals: jest.fn().mockReturnValue(18),
  transfer: jest.fn().mockReturnValue("0xTransactionData"),
};

const mockExecutePermitTransferFrom = jest.fn().mockReturnValue({ hash: "0xTransactionHash" });
const mockPermit2Contract = {
  estimateGas: {
    permitTransferFrom: jest.fn().mockReturnValue(parseUnits("0.02", 18)),
  },
  provider: {
    getNetwork() {
      return 1;
    },
  },
  connect: jest.fn().mockReturnValue({ executePermitTransferFrom: mockExecutePermitTransferFrom }),
};

const mockWallet = {
  address: "0xAddress",
  _signTypedData: jest.fn().mockReturnValue("signature"),
};

const erc20Wrapper = new Erc20Wrapper(mockErc20Contract as unknown as ethers.Contract);

const permit2Wrapper = new Permit2Wrapper(mockPermit2Contract as unknown as ethers.Contract);

describe("web3.ts", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });
  it("Should return correct ERC20 token contract", async () => {
    const networkId = 100; // gnosis
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const contract = await getContract(networkId, tokenAddress);
    expect(contract.address).toEqual(tokenAddress);
    expect(contract.interface).toEqual(new Interface(ERC20_ABI));
  }, 120000);

  it("Should return correct ERC20 token data", async () => {
    const tokenSymbol = await erc20Wrapper.getSymbol();
    const tokenDecimals = await erc20Wrapper.getDecimals();
    const tokenBalance = await erc20Wrapper.getBalance("0xRecipient");
    expect(tokenSymbol).toEqual("WXDAI");
    expect(tokenDecimals).toEqual(18);
    expect(mockErc20Contract.balanceOf).toHaveBeenCalledWith("0xRecipient");
    expect(tokenBalance).toEqual(BigNumber.from("1000"));
  }, 120000);

  it("Should return correct wallet address", async () => {
    const networkId = 100; // gnosis
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const contract = await getContract(networkId, tokenAddress);
    const evmWallet = await getEvmWallet(
      "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e",
      contract.provider
    );
    const evmWalletAddress = await evmWallet.getAddress();
    expect(evmWalletAddress.toLowerCase()).toEqual("0x94d7a85efef179560f9b821cadd20056600fdb9d");
  }, 120000);

  it("Should return a valid tx", async () => {
    const permitBatchTransferFromData = await permit2Wrapper.generateBatchTransferPermit(
      mockWallet as unknown as ethers.Wallet,
      "0xTokenAddress",
      ["0xRecipient1", "0xRecipient2"],
      [utils.parseUnits("100", 18), utils.parseUnits("200", 18)],
      BigNumber.from("0")
    );
    const tx = await permit2Wrapper.sendPermitTransferFrom(
      mockWallet as unknown as ethers.Wallet,
      permitBatchTransferFromData
    );
    expect(mockExecutePermitTransferFrom).toHaveBeenCalledWith(
      permitBatchTransferFromData.permitBatchTransferFromData,
      permitBatchTransferFromData.transfers,
      "0xAddress",
      permitBatchTransferFromData.signature
    );
    expect(tx.hash).toEqual("0xTransactionHash");
  }, 120000);

  it("Should estimates transfer fee correctly", async () => {
    const permitBatchTransferFromData = await permit2Wrapper.generateBatchTransferPermit(
      mockWallet as unknown as ethers.Wallet,
      "0xTokenAddress",
      ["0xRecipient1", "0xRecipient2"],
      [utils.parseUnits("100", 18), utils.parseUnits("200", 18)],
      BigNumber.from("0")
    );
    const estimate = await permit2Wrapper.estimatePermitTransferFromGas(
      mockWallet as unknown as ethers.Wallet,
      permitBatchTransferFromData
    );
    expect(estimate).toEqual(parseUnits("0.02", 18));
  }, 120000);
});
