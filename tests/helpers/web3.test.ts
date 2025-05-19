import {
  Erc20Wrapper,
  getEvmWallet,
  getContract,
  ERC20_ABI,
  Permit2Wrapper,
  BatchTransferPermit,
  TransferRequest,
} from "../../src/helpers/web3.ts";
import { PERMIT_AGGREGATOR_CONTRACT_ADDRESS } from "../../src/helpers/constants";
import { Interface } from "ethers/lib/utils";
import { BigNumber, ethers, utils } from "ethers";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { MaxUint256 } from "@uniswap/permit2-sdk";

class MockProvider extends ethers.providers.BaseProvider {
  override async getNetwork(): Promise<ethers.providers.Network> {
    return Promise.resolve(this.network);
  }

  override async getCode(address: string): Promise<string> {
    return this._getCode ? await this._getCode(address) : "0x";
  }

  setGetCode(fn: (address: string) => Promise<string>) {
    this._getCode = fn;
  }

  private _getCode?: (address: string) => Promise<string>;
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
    const contract = getContract(networkId, tokenAddress, ERC20_ABI);
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
    const evmWallet = getEvmWallet("100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e", mockProvider);
    const evmWalletAddress = await evmWallet.getAddress();
    expect(evmWalletAddress.toLowerCase()).toEqual("0x94d7a85efef179560f9b821cadd20056600fdb9d");
  }, 120000);

  it("Should use PERMIT_AGGREGATOR_CONTRACT_ADDRESS when contract exists", async () => {
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const evmWallet = getEvmWallet("100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e", mockProvider);

    mockProvider.setGetCode(async () => "0x1234"); // Mock contract exists

    const permitBatchTransferFromData = await permit2Wrapper.generateBatchTransferPermit(
      evmWallet,
      tokenAddress,
      [
        {
          address: "0x1",
          amount: utils.parseUnits("100", 18),
        },
        {
          address: "0x2",
          amount: utils.parseUnits("200", 18),
        },
      ] as TransferRequest[],
      BigNumber.from("0")
    );
    expect(permitBatchTransferFromData).toEqual({
      permitBatchTransferFromData: {
        permitted: [
          { token: tokenAddress, amount: utils.parseUnits("100", 18) },
          { token: tokenAddress, amount: utils.parseUnits("200", 18) },
        ],
        spender: PERMIT_AGGREGATOR_CONTRACT_ADDRESS,
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

  it("Should fallback to wallet address when contract doesn't exist", async () => {
    const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
    const evmWallet = getEvmWallet("100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e", mockProvider);

    mockProvider.setGetCode(async () => "0x"); // Mock contract doesn't exist

    const permitBatchTransferFromData = await permit2Wrapper.generateBatchTransferPermit(
      evmWallet,
      tokenAddress,
      [
        {
          address: "0x1",
          amount: utils.parseUnits("100", 18),
        },
        {
          address: "0x2",
          amount: utils.parseUnits("200", 18),
        },
      ] as TransferRequest[],
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
