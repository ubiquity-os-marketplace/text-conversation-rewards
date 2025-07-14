import { MaxUint256 } from "@uniswap/permit2-sdk";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { BigNumber, ethers, utils } from "ethers";
import { Interface } from "ethers/lib/utils";
import {
  BatchTransferPermit,
  ERC20_ABI,
  Erc20Wrapper,
  getContract,
  getEvmWallet,
  Permit2Wrapper,
  TransferRequest,
} from "../../src/helpers/web3";

class MockProvider extends ethers.providers.BaseProvider {
  async getNetwork(): Promise<ethers.providers.Network> {
    return this.network;
  }
}

const mockProvider = new MockProvider(100);

const mockErc20Contract = {
  balanceOf: mock().mockReturnValue(BigNumber.from("1000")),
  symbol: mock().mockReturnValue("WXDAI"),
  decimals: mock().mockReturnValue(18),
  allowance: mock().mockReturnValue(BigNumber.from("100")),
  provider: mockProvider,
};

const erc20Wrapper = new Erc20Wrapper(mockErc20Contract as unknown as ethers.Contract);
const permit2Wrapper = new Permit2Wrapper(mockErc20Contract as unknown as ethers.Contract);

describe("web3.ts", () => {
  beforeEach(async () => {
    mock.restore();
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
        "0xff39fa6eacfd5147a5fae772f93dc9b47d97c684423b2ccd44a4d3516b5d238f246db6fc0690e269f5ee1a15761a29c9e8347072b291db716cfdfb0488b1be141c",
    } as BatchTransferPermit);
  }, 120000);
});
