import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
import { ethers } from "ethers";

/**
 * Returns ERC20 token symbol
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token symbol
 */
export async function getErc20TokenSymbol(networkId: number, tokenAddress: string) {
  const abi = ["function symbol() view returns (string)"];

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

  // fetch token symbol
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  return await contract.symbol();
}

/**
 * Returns ERC20 token balance of the funding wallet
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param fundingWalledAddress funding wallet address
 * @returns ERC20 token balance of the funding wallet
 */
export async function getFundingWalletBalance(networkId: number, tokenAddress: string, fundingWalledAddress: string) {
  const abi = ["function balanceOf(address) view returns (uint256)"];

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

  // fetch token balance
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  return await contract.balanceOf(fundingWalledAddress);
}

/**
 * Returns Transaction for the ERC20 token transfer
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param _evmPrivateEncrypted encrypted private key of the funding wallet address
 * @param to reciever address 
 * @param amount Amount of ERC20 token to be transfered
 * @returns Transaction for the ERC20 token transfer
 */
export async function transferTo(networkId: number, tokenAddress: string, _evmPrivateEncrypted: string, to: string, amount: string) {
  const abi = ["function transfer(address,uint256) public returns (bool)"];

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

  // send the transaction
  // TODO: sign the transaction
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  return await contract.transfer(to, amount);
}
