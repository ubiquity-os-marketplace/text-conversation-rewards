import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
import { ethers, utils, Contract, Wallet } from "ethers";

// Required ERC20 ABI functions
export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() public view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) public returns (bool)",
];

/**
 * Returns ERC20 token contract
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token contract
 */

export async function getErc20TokenContract(networkId: number, tokenAddress: string) {
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

  return new Contract(tokenAddress, ERC20_ABI, provider);
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
  async getBalance(address: string) {
    return await this._contract.balanceOf(address);
  }

  /**
   * Returns Transaction data of the ERC20 token transfer
   * @param evmWallet Wallet to transfer ERC20 token from
   * @param address Address to send ERC20 token
   * @param amount Amount of ERC20 token to be transferred
   * @returns Transaction data of the ERC20 token transfer
   */
  async sendTransferTransaction(evmWallet: Wallet, address: string, amount: string) {
    const tokenDecimals = await this.getDecimals();
    const _amount = utils.parseUnits(amount, tokenDecimals);

    // Create the signed transaction
    try {
      const tx = await this._contract.transfer(address, _amount);
      return await evmWallet.sendTransaction(tx);
    } catch (error) {
      const errorMessage = `Error sending transaction: ${error}`;
      throw new Error(errorMessage);
    }
  }
}
