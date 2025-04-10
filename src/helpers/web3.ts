import { HandlerConstructorConfig, NetworkId, RPCHandler } from "@ubiquity-dao/rpc-handler";
import { MaxUint256, PERMIT2_ADDRESS, PermitBatchTransferFrom, SignatureTransfer } from "@uniswap/permit2-sdk";
import { BigNumber, BigNumberish, Contract, ContractInterface, ethers, Wallet } from "ethers";
import permit2Abi from "../abi/permit2.json";

export interface TransferRequest {
  address: string;
  amount: BigNumber;
}
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
  "function allowance(address,address) view returns (uint256)",
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
  return new ethers.Wallet(privateKey, provider);
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
   * @param owner address
   * @param spender address
   * @returns ERC20 token allowance
   */
  async getAllowance(owner: string, spender: string): Promise<BigNumber> {
    return await this._contract.allowance(owner, spender);
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
   * @param transferRequests List of requested transfers
   * @param nonce The nonce used for Permit2 SignatureTransform
   * @returns Batch transfer permit
   */
  async generateBatchTransferPermit(
    evmWallet: Wallet,
    tokenAddress: string,
    transferRequests: TransferRequest[],
    nonce: BigNumber
  ): Promise<BatchTransferPermit> {
    const permitBatchTransferFromData: PermitBatchTransferFrom = {
      permitted: transferRequests.map((request) => ({ token: tokenAddress, amount: request.amount })),
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
    const transfers = transferRequests.map((request) => ({
      to: request.address,
      requestedAmount: request.amount,
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
    const gasLimit = await this._permit2.connect(evmWallet).estimateGas.permitTransferFrom(
      {
        permitted: batchTransferPermit.permitBatchTransferFromData.permitted,
        nonce: batchTransferPermit.permitBatchTransferFromData.nonce,
        deadline: batchTransferPermit.permitBatchTransferFromData.deadline,
      },
      batchTransferPermit.transfers,
      evmWallet.address,
      batchTransferPermit.signature
    );

    const gasPrice = await this._permit2.provider.getGasPrice();
    return gasPrice.mul(gasLimit);
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

  async isNonceClaimed(ownerAddress: string, nonce: BigNumberish): Promise<boolean> {
    const { wordPos, bitPos } = this.nonceBitmap(nonce);

    const bitmap = await this._permit2.nonceBitmap(ownerAddress, wordPos);
    const bit = BigNumber.from(1).shl(bitPos);
    const flipped = BigNumber.from(bitmap).xor(bit);
    const isClaimed = bit.and(flipped).eq(0);

    return isClaimed;
  }

  nonceBitmap(nonce: BigNumberish): { wordPos: BigNumber; bitPos: number } {
    // wordPos is the first 248 bits of the nonce
    const wordPos = BigNumber.from(nonce).shr(8);
    // bitPos is the last 8 bits of the nonce
    const bitPos = BigNumber.from(nonce).and(255).toNumber();
    return { wordPos, bitPos };
  }
}
