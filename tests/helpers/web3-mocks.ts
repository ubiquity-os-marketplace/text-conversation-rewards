import { jest } from "@jest/globals";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ERC20_ABI, PERMIT2_ABI } from "../../src/helpers/web3";

export function mockWeb3Module(modulePath?: string) {
  const mocks = {
    Erc20Wrapper: {
      getBalance: jest.fn().mockReturnValue(parseUnits("20000", 18) as BigNumber),
      getSymbol: jest.fn().mockReturnValue("WXDAI"),
      getDecimals: jest.fn().mockReturnValue(18),
      getAllowance: jest.fn().mockReturnValue(parseUnits("20000", 18) as BigNumber),
    },
    Permit2Wrapper: {
      generateBatchTransferPermit: jest.fn().mockReturnValue({
        signature: "signature",
      }),
      sendPermitTransferFrom: jest
        .fn()
        .mockReturnValue({ hash: `0xSent`, wait: async () => Promise.resolve({ blockNumber: 1 }) }),
      estimatePermitTransferFromGas: jest.fn().mockReturnValue(parseUnits("0.02", 18)),
      isNonceClaimed: jest.fn().mockImplementation(async () => false),
    },
    getContract: jest.fn().mockReturnValue({ provider: "dummy" }),
    getEvmWallet: jest.fn(() => ({
      address: "0xAddress",
      getBalance: jest.fn().mockReturnValue(parseUnits("1", 18)),
    })),
  };
  jest.unstable_mockModule(modulePath ?? "../src/helpers/web3", () => {
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
  return mocks;
}
