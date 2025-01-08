import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
import { Context } from "@ubiquity-os/permit-generation";
import { ethers, utils } from "ethers";

/**
 * Returns the funding wallet
 * @param privateKey of the funding wallet
 * @param provider ethers.Provider
 * @returns the funding wallet
 */
async function getFundingWallet(privateKey: string, provider: ethers.providers.Provider) {
  try {
    return new ethers.Wallet(privateKey, provider);
  } catch (error) {
    const errorMessage = `Failed to instantiate wallet: ${error}`;
    throw new Error(errorMessage);
  }
}

/**
 * Returns ERC20 token contract
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token contract
 */

async function getErc20TokenContract(networkId: number, tokenAddress: string) {
  const abi = [
    "function symbol() view returns (string)",
    "function decimals() public view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) public returns (bool)",
  ];

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

  return new ethers.Contract(tokenAddress, abi, provider);
}
/**
 * Returns ERC20 token symbol
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token symbol
 */
export async function getErc20TokenSymbol(networkId: number, tokenAddress: string) {
  return await (await getErc20TokenContract(networkId, tokenAddress)).symbol();
}

/**
 * Returns ERC20 token decimals
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @returns ERC20 token decimals
 */
async function getErc20TokenDecimals(networkId: number, tokenAddress: string) {
  return await (await getErc20TokenContract(networkId, tokenAddress)).decimals();
}

/**
 * Returns ERC20 token balance of the funding wallet
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param fundingWalledAddress funding wallet address
 * @returns ERC20 token balance of the funding wallet
 */
export async function getFundingWalletBalance(networkId: number, tokenAddress: string, privateKey: string) {
  const contract = await getErc20TokenContract(networkId, tokenAddress);
  const fundingWallet = await getFundingWallet(privateKey, contract.provider);
  return await contract.balanceOf(await fundingWallet.getAddress());
}

/**
 * Returns Transaction for the ERC20 token transfer
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param _evmPrivateEncrypted encrypted private key of the funding wallet address
 * @param username github user name of the beneficiary
 * @param amount Amount of ERC20 token to be transferred
 * @returns Transaction for the ERC20 token transfer
 */
export async function transferFromFundingWallet(
  context: Context,
  networkId: number,
  tokenAddress: string,
  privateKey: string,
  username: string,
  amount: string
) {
  // Obtain the beneficiary wallet address from the github user name
  const { data: userData } = await context.octokit.rest.users.getByUsername({ username });
  if (!userData) {
    throw new Error(`GitHub user was not found for id ${username}`);
  }
  const userId = userData.id;
  const { wallet } = context.adapters.supabase;
  const beneficiaryWalletAddress = await wallet.getWalletByUserId(userId);
  if (!beneficiaryWalletAddress) {
    throw new Error("Beneficiary wallet not found");
  }

  const tokenDecimals = await getErc20TokenDecimals(networkId, tokenAddress);
  const _contract = await getErc20TokenContract(networkId, tokenAddress);
  // Construct the funding wallet from the privateKey
  const fundingWallet = await getFundingWallet(privateKey, _contract.provider);

  // send the transaction
  const contract = new ethers.Contract(tokenAddress, _contract.abi, fundingWallet);
  return await contract.transfer(beneficiaryWalletAddress, utils.parseUnits(amount, tokenDecimals));
}
