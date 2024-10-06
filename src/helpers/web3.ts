import { RPCHandler, HandlerConstructorConfig } from "@ubiquity-dao/rpc-handler";
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
    // @ts-expect-error expects an enum when imported through ESNext
    networkId: networkId,
    rpcTimeout: 1500,
    autoStorage: false,
    cacheRefreshCycles: 10,
  };
  const handler = new RPCHandler(config);
  const provider = await handler.getFastestRpcProvider();

  // fetch token symbol
  // @ts-expect-error expects a contract when imported through ESNext
  const contract = new ethers.Contract(tokenAddress, abi, provider);
  return await contract.symbol();
}
