import { mock } from "bun:test";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ERC20_ABI, PERMIT2_ABI } from "../../src/helpers/web3";

const mocks = {
  Erc20Wrapper: {
    getBalance: mock().mockReturnValue(parseUnits("20000", 18) as BigNumber),
    getSymbol: mock().mockReturnValue("WXDAI"),
    getDecimals: mock().mockReturnValue(18),
    getAllowance: mock().mockReturnValue(parseUnits("20000", 18) as BigNumber),
  },
  Permit2Wrapper: {
    generateBatchTransferPermit: mock().mockReturnValue({
      signature: "signature",
    }),
    sendPermitTransferFrom: mock().mockReturnValue({
      hash: `0xSent`,
      wait: async () => Promise.resolve({ blockNumber: 1 }),
    }),
    estimatePermitTransferFromGas: mock().mockReturnValue(parseUnits("0.02", 18)),
    isNonceClaimed: mock().mockImplementation(async () => false),
  },
  getContract: mock().mockReturnValue({ provider: "dummy" }),
  getEvmWallet: mock(() => ({
    address: "0xAddress",
    getBalance: mock().mockReturnValue(parseUnits("1", 18)),
  })),
};
mock.module("../src/helpers/web3", () => {
  class MockErc20Wrapper {
    getBalance = mocks.Erc20Wrapper.getBalance;
    getSymbol = mocks.Erc20Wrapper.getSymbol;
    getDecimals = mocks.Erc20Wrapper.getDecimals;
    getAllowance = mocks.Erc20Wrapper.getAllowance;
  }
  class MockPermit2Wrapper {
    generateBatchTransferPermit = mocks.Permit2Wrapper.generateBatchTransferPermit;
    sendPermitTransferFrom = mocks.Permit2Wrapper.sendPermitTransferFrom;
    estimatePermitTransferFromGas = mocks.Permit2Wrapper.estimatePermitTransferFromGas;
    isNonceClaimed = mocks.Permit2Wrapper.isNonceClaimed;
  }
  return {
    PERMIT2_ABI: PERMIT2_ABI,
    ERC20_ABI: ERC20_ABI,
    Erc20Wrapper: MockErc20Wrapper,
    Permit2Wrapper: MockPermit2Wrapper,
    getContract: mocks.getContract,
    getEvmWallet: mocks.getEvmWallet,
  };
});

export const web3Mocks = mocks;
