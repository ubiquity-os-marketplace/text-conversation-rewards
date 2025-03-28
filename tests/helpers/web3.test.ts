import {
  Erc20Wrapper,
  getEvmWallet,
  getContract,
  ERC20_ABI,
  Permit2Wrapper,
  BatchTransferPermit,
} from "../../src/helpers/web3";
import { Interface } from "ethers/lib/utils";
import { BigNumber, ethers, utils } from "ethers";
import { describe, expect, it, jest } from "@jest/globals";
import { MaxUint256 } from "@uniswap/permit2-sdk";
import { Beneficiary } from "../../src/parser/payment-module";

class MockProvider extends ethers.providers.BaseProvider {
  async getNetwork(): Promise<ethers.providers.Network> {
    return this.network;
  }
}

const mockProvider = new MockProvider(100);

const mockErc20Contract = {
  balanceOf: jest.fn().mockReturnValue(BigNumber.from("1000")),
  symbol: jest.fn().mockReturnValue("WXDAI"),
  decimals: jest.fn().mockReturnValue(18),
  allowance: jest.fn().mockReturnValue(BigNumber.from("100")),
  provider: mockProvider,
};

const erc20Wrapper = new Erc20Wrapper(mockErc20Contract as unknown as ethers.Contract);
const permit2Wrapper = new Permit2Wrapper(mockErc20Contract as unknown as ethers.Contract);

describe("web3.ts", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
  });
  it("Should return correct ERC20 token contract", async () => {
    const networkId = 100; // gnosis
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const contract = await getContract(networkId, tokenAddress, ERC20_ABI);
    expect(contract.address).toEqual(tokenAddress);
    expect(contract.interface).toEqual(new Interface(ERC20_ABI));
  }, 120000);

  it("Should return correct ERC20 token data", async () => {
    const tokenSymbol = await erc20Wrapper.getSymbol();
    const tokenDecimals = await erc20Wrapper.getDecimals();
    const tokenBalance = await erc20Wrapper.getBalance("0xRecipient");
    const tokenAllowance = await erc20Wrapper.getAllowance("0xFrom", "0xTo");
    expect(tokenSymbol).toEqual("WXDAI");
    expect(tokenDecimals).toEqual(18);
    expect(tokenAllowance).toEqual(BigNumber.from("100"));
    expect(mockErc20Contract.balanceOf).toHaveBeenCalledWith("0xRecipient");
    expect(tokenBalance).toEqual(BigNumber.from("1000"));
  }, 120000);

  it("Should return correct wallet address", async () => {
    const evmWallet = await getEvmWallet(
      "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e",
      mockProvider
    );
    const evmWalletAddress = await evmWallet.getAddress();
    expect(evmWalletAddress.toLowerCase()).toEqual("0x94d7a85efef179560f9b821cadd20056600fdb9d");
  }, 120000);

  it("Should generate a PermitBatchTransferFrom result correctly", async () => {
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const evmWallet = await getEvmWallet(
      "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e",
      mockProvider
    );
    const permitBatchTransferFromData = await permit2Wrapper.generateBatchTransferPermit(
      evmWallet,
      tokenAddress,
      [
        {
          username: "test1",
          address: "0x1",
          amount: utils.parseUnits("100", 18),
        },
        {
          username: "test2",
          address: "0x2",
          amount: utils.parseUnits("200", 18),
        },
      ] as Beneficiary[],
      BigNumber.from("0")
    );
    expect(permitBatchTransferFromData).toEqual({
      permitBatchTransferFromData: {
        permitted: [
          { token: tokenAddress, amount: utils.parseUnits("100", 18) },
          { token: tokenAddress, amount: utils.parseUnits("200", 18) },
        ],
        spender: evmWallet.address,
        nonce: BigNumber.from("0"),
        deadline: MaxUint256,
      },
      transfers: [
        { to: "0x1", requestedAmount: utils.parseUnits("100", 18) },
        { to: "0x2", requestedAmount: utils.parseUnits("200", 18) },
      ],
      signature:
        "0x758bcfab03a055e22db67d02d906fe60755cc7e3f47e89026354c94f2a26554c76e9b4e1e4d91479ba89667cbf3d1ed732800ca54b81879e8790a2b5b284cc351c",
    } as BatchTransferPermit);
  }, 120000);
});
