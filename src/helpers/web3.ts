import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
import { ethers, Contract, Wallet, BigNumber, ContractInterface, BigNumberish } from "ethers";
import { PERMIT2_ADDRESS, PermitBatchTransferFrom, SignatureTransfer, MaxUint256 } from "@uniswap/permit2-sdk";
import { Beneficiary } from "../parser/payment-module";
import { permit2Abi } from "../abi/permit2";

export interface BatchTransferPermit {
  permitBatchTransferFromData: PermitBatchTransferFrom;
  signature: string;
  transfers: { to: string; requestedAmount: BigNumberish }[];
}
// Required ERC20 ABI functions
export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() public view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) public returns (bool)",
];

// Required PERMIT2 ABI functions
export const PERMIT2_ABI = permit2Abi;

/**
 * Returns EVM token contract
 * @param networkId Network id
 * @param contractAddress EVM contract address
 * @param abi Contract ABI
 * @returns EVM token contract
 */

export async function getContract(
  networkId: number,
  contractAddress: string,
  abi: ContractInterface,
  retryCount: number = 5,
  retryDelay: number = 500
) {
  // get fastest RPC
  const config: HandlerConstructorConfig = {
    networkName: null,
    networkRpcs: null,
    proxySettings: {
      retryCount: retryCount,
      retryDelay: retryDelay,
      logTier: null,
      logger: null,
      strictLogs: false,
      disabled: retryCount === 0,
    },
    runtimeRpcs: null,
    networkId: String(networkId) as NetworkId,
    rpcTimeout: 1500,
    autoStorage: false,
    cacheRefreshCycles: 10,
  };
  const handler = new RPCHandler(config);
  const provider = await handler.getFastestRpcProvider();
  return new Contract(contractAddress, abi, provider);
}

/**
 * Returns the evm wallet associated with the privateKey
 * @param privateKey of the evm wallet
 * @param provider ethers.Provider
 * @returns the evm wallet
 */
export async function getEvmWallet(privateKey: string, provider: ethers.providers.Provider) {
  try {
    return new ethers.Wallet(privateKey, provider);
  } catch (error) {
    const errorMessage = `Failed to instantiate wallet: ${error}`;
    throw new Error(errorMessage);
  }
}

export class Erc20Wrapper {
  constructor(private _contract: Contract) {}

  /**
   * Returns ERC20 token symbol
   * @returns ERC20 token symbol
   */
  async getSymbol() {
    return await this._contract.symbol();
  }

  /**
   * Returns ERC20 token decimals
   * @returns ERC20 token decimals
   */
  async getDecimals() {
    return await this._contract.decimals();
  }

  /**
   * Returns ERC20 token balance of the input address
   * @param address input address
   * @returns ERC20 token balance of the input address
   */
  async getBalance(address: string): Promise<BigNumber> {
    return await this._contract.balanceOf(address);
  }

  /**
   * Returns ERC20 token allowance
   * @param from address
   * @param to address
   * @returns ERC20 token allowance
   */
  async getAllowance(from: string, to: string): Promise<BigNumber> {
    return await this._contract.allowance(from, to);
  }
}

/**
 * A wrapper class for interacting with the Permit2 smart contract.
 * Provides functionality to transfer ERC20 tokens to multiple recipients;
 * This leverages the Permit2 nonce to prevent payment replays.
 */
export class Permit2Wrapper {
  constructor(private _permit2: Contract) {}

  /**
   * Returns Batch transfer permit
   * @param evmWallet Wallet to transfer ERC20 token from
   * @param tokenAddress ERC20 token address
   * @param beneficiaries List of Beneficiary
   * @param nonce The nonce used for Permit2 SignatureTransform
   * @returns Batch transfer permit
   */
  async generateBatchTransferPermit(
    evmWallet: Wallet,
    tokenAddress: string,
    beneficiaries: Beneficiary[],
    nonce: BigNumber
  ): Promise<BatchTransferPermit> {
    const permitBatchTransferFromData: PermitBatchTransferFrom = {
      permitted: beneficiaries.map((beneficiary) => ({ token: tokenAddress, amount: beneficiary.amount })),
      spender: evmWallet.address,
      nonce,
      deadline: MaxUint256,
    };
    const _network = await this._permit2.provider.getNetwork();
    const { domain, types, values } = SignatureTransfer.getPermitData(
      permitBatchTransferFromData,
      PERMIT2_ADDRESS,
      _network.chainId
    );
    const signature = await evmWallet._signTypedData(domain, types, values);
    const transfers = beneficiaries.map((beneficiary) => ({
      to: beneficiary.address,
      requestedAmount: beneficiary.amount,
    }));
    return { permitBatchTransferFromData, signature, transfers };
  }

  /**
   * Returns Gas estimation of permitTransferFrom contract call
   * @param evmWallet Wallet to transfer ERC20 token from
   * @param batchTransferPermit Object
   * @returns Gas estimation of permitTransferFrom contract call
   */
  async estimatePermitTransferFromGas(evmWallet: Wallet, batchTransferPermit: BatchTransferPermit): Promise<BigNumber> {
    return await this._permit2.connect(evmWallet).estimateGas.permitTransferFrom(
      {
        permitted: batchTransferPermit.permitBatchTransferFromData.permitted,
        nonce: batchTransferPermit.permitBatchTransferFromData.nonce,
        deadline: batchTransferPermit.permitBatchTransferFromData.deadline,
      },
      batchTransferPermit.transfers,
      evmWallet.address,
      batchTransferPermit.signature
    );
  }
  /**
   * Returns Transaction response of the permit2 permitTransferFrom contract call
   * @param evmWallet Wallet to transfer ERC20 token from
   * @param batchTransferPermit Object
   * @returns Transaction response of the permitTransferFrom contract call
   */
  async sendPermitTransferFrom(
    evmWallet: Wallet,
    batchTransferPermit: BatchTransferPermit
  ): Promise<ethers.providers.TransactionResponse> {
    return await this._permit2.connect(evmWallet).permitTransferFrom(
      {
        permitted: batchTransferPermit.permitBatchTransferFromData.permitted,
        nonce: batchTransferPermit.permitBatchTransferFromData.nonce,
        deadline: batchTransferPermit.permitBatchTransferFromData.deadline,
      },
      batchTransferPermit.transfers,
      evmWallet.address,
      batchTransferPermit.signature
    );
  }
}
