import { BigNumber } from "ethers";
import { jest } from "@jest/globals";
import {
  getErc20TokenSymbol,
  getErc20TokenDecimals,
  getErc20Balance,
  getEvmWallet,
  getErc20TokenContract,
  createTransferSignedTx,
  ERC20_ABI,
} from "../../src/helpers/web3";
import { Interface, parseUnits } from "ethers/lib/utils";

/*
// jest.unstable_mockModule("@ubiquity-dao/rpc-handler", () => {
//   return {
//     RPCHandler: {
//       getFastestRpcProvider: jest.fn()
//     },
//   };
// });

// jest.mock("ethers", () => {
//   const originalModule = jest.requireActual("ethers");

//   return {
//     __esModule: true,
//     ...originalModule,
//     Contract: jest.fn(() => ({
//       balanceOf: BigNumber.from("100"),
//       symbol: "WXDAI",
//       decimals: 18
//     })),
//   };
// });
*/

describe("web3.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
  describe("getErc20Balance()", () => {
    it("Should return ERC20 token balance of the input wallet", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const tokenBalance: BigNumber = await getErc20Balance(
        networkId,
        tokenAddress,
        "0x94d7a85efef179560f9b821cadd20056600fdb9d"
      );
      expect(tokenBalance).toEqual(BigNumber.from("100"));
    }, 120000);
  });
  describe("getEvmWallet()", () => {
    it("Should return ERC20 token decimals", async () => {
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

  describe("createTransferSignedTx()", () => {
    it("Should return a valid tx", async () => {
      const networkId = 100; // gnosis
      const tokenAddress = "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"; // WXDAI
      const tx = await createTransferSignedTx(
        networkId,
        tokenAddress,
        "100958e64966448354216e91d4d4b9418c3fa0cb0a21b935535ced1df8145a0e",
        "0x94d7a85efef179560f9b821cadd20056600fdb9d",
        parseUnits("100", 18).toString()
      );
      expect(tx).toEqual("sdvfds");
    }, 120000);
  });
});
