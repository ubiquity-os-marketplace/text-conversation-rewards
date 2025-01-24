import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
import { ethers, Contract, Wallet, BigNumber } from "ethers";

// Required ERC20 ABI functions
export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() public view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) public returns (bool)",
];

// Disperse App ABI functions
export const DISPERSE_APP_ABI = [
  "function disperseEther(address[],uint256[]) external payable",
  "function disperseToken(address,address[],uint256[]) external",
  "function disperseTokenSimple(address,address[],uint256[]) external",
];

export const DISPERSE_APP_CONTRACT_ADDRESS = "0xD152f549545093347A162Dce210e7293f1452150";

/**
 * Returns EVM token contract
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param abi Contract ABI
 * @returns EVM token contract
 */

export async function getContract(networkId: number, tokenAddress: string, abi = ERC20_ABI) {
  // get fastest RPC
  const config: HandlerConstructorConfig = {
    networkName: null,
    networkRpcs: null,
    proxySettings: {
      retryCount: 5,
      retryDelay: 500,
      logTier: null,
      logger: null,
      strictLogs: false,
    },
    runtimeRpcs: null,
    networkId: String(networkId) as NetworkId,
    rpcTimeout: 1500,
    autoStorage: false,
    cacheRefreshCycles: 10,
  };
  const handler = new RPCHandler(config);
  const provider = await handler.getFastestRpcProvider();

  return new Contract(tokenAddress, abi, provider);
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
}

/**
 * A wrapper class for interacting with the Disperse application.
 * Provides functionality to disperse ERC20 tokens to multiple recipients.
 */
export class DisperseAppWrapper {
  constructor(private _contract: Contract) {}

  /**
   * Returns Fee estimation of disperseToken function call
   * @param from msg.sender address
   * @param tokenAddress ERC20 token address
   * @param recipients Recipient addresses
   * @param values Respective values of the ERC20 tokens to be transferred to the recipients
   * @returns Fee estimation of disperseToken function call
   */
  async estimateDisperseTokenGas(
    from: string,
    tokenAddress: string,
    recipients: string[],
    values: BigNumber[]
  ): Promise<BigNumber> {
    return await this._contract.estimateGas.disperseToken(tokenAddress, recipients, values, { from });
  }

  /**
   * Returns Transaction response of the disperseToken contract call
   * @param evmWallet Wallet to transfer ERC20 token from
   * @param tokenAddress ERC20 token address
   * @param recipients Recipient addresses
   * @param values Respective values of the ERC20 tokens to be transferred to the recipients
   * @returns Transaction response of the disperseToken contract call
   */
  async sendDisperseTokenTransaction(
    evmWallet: Wallet,
    tokenAddress: string,
    recipients: string[],
    values: BigNumber[]
  ): Promise<ethers.providers.TransactionResponse> {
    const contract = new Contract(this._contract.address, DISPERSE_APP_ABI, evmWallet);

    // Create the signed transaction
    try {
      return await contract.disperseToken(tokenAddress, recipients, values);
    } catch (error) {
      const errorMessage = `Failed to send the transaction for the disperseToken contract call: ${error}`;
      throw new Error(errorMessage);
    }
  }
}
