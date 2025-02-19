// import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
// import { ethers } from "ethers";

/**
 * Returns ERC20 token symbol
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token symbol
 */
export async function getErc20TokenSymbol(networkId: number, tokenAddress: string) {
  if (tokenAddress === "0xC6ed4f520f6A4e4DC27273509239b7F8A68d2068") {
    return "UUSD";
  }
  return "WXDAI";
  // const abi = ["function symbol() view returns (string)"];
  //
  // // get fastest RPC
  // const config: HandlerConstructorConfig = {
  //   networkName: null,
  //   networkRpcs: null,
  //   proxySettings: {
  //     retryCount: 5,
  //     retryDelay: 500,
  //     logTier: null,
  //     logger: null,
  //     strictLogs: false,
  //   },
  //   runtimeRpcs: null,
  //   networkId: String(networkId) as NetworkId,
  //   rpcTimeout: 1500,
  //   autoStorage: false,
  //   cacheRefreshCycles: 10,
  // };
  // const handler = new RPCHandler(config);
  // const provider = await handler.getFastestRpcProvider();
  //
  // // fetch token symbol
  // const contract = new ethers.Contract(tokenAddress, abi, provider);
  // return await contract.symbol();
}
