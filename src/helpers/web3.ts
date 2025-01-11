import { RPCHandler, HandlerConstructorConfig, NetworkId } from "@ubiquity-dao/rpc-handler";
import { ethers } from "ethers";

// Required ERC20 ABI functions
export const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() public view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) public returns (bool)",
];

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

  return new ethers.Contract(tokenAddress, ERC20_ABI, provider);
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
export async function getErc20TokenDecimals(networkId: number, tokenAddress: string) {
  return await (await getErc20TokenContract(networkId, tokenAddress)).decimals();
}

/**
 * Returns ERC20 token balance of the input address
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param address input address
 * @returns ERC20 token balance of the input address
 */
export async function getErc20Balance(networkId: number, tokenAddress: string, address: string) {
  const contract = await getErc20TokenContract(networkId, tokenAddress);
  return await contract.balanceOf(address);
}

/**
 * Returns Transaction for the ERC20 token transfer
 * @param networkId Network id
 * @param tokenAddress ERC20 token address
 * @param privateKey private key of the evm wallet
 * @param username github user name of the beneficiary
 * @param address Address to send ERC20 token
 * @param amount Amount of ERC20 token to be transferred
 * @returns Transaction for the ERC20 token transfer
 */
export async function createTransferSignedTx(
  networkId: number,
  tokenAddress: string,
  privateKey: string,
  address: string,
  amount: string
) {
  const tokenDecimals = await getErc20TokenDecimals(networkId, tokenAddress);
  const _amount = ethers.utils.parseUnits(amount, tokenDecimals);

  const contract = await getErc20TokenContract(networkId, tokenAddress);
  // Construct the evm wallet from the privateKey
  const evmWallet = await getEvmWallet(privateKey, contract.provider);

  // Create the signed transaction
  try {
    // Encode the ERC-20 transfer function call
    const data = contract.interface.encodeFunctionData("transfer", [address, _amount]);

    // The transaction details
    const tx = {
      to: tokenAddress, // The ERC-20 contract address
      data: data, // Encoded transfer function call
      gasLimit: await contract.estimateGas.transfer(address, _amount),
      gasPrice: await contract.provider.getGasPrice(), // Current gas price from the provider
      nonce: await evmWallet.getTransactionCount(), // Account nonce
    };

    const signedTx = await evmWallet.signTransaction(tx);
    return signedTx;
  } catch (error) {
    const errorMessage = `Error creating signed transaction: ${error}`;
    throw new Error(errorMessage);
  }
}

/**
 * Send the signed transaction
 * @param networkId Network id
 * @param privateKey private key of the evm wallet
 * @returns Transaction data
 */
export async function sendSignedTx(networkId: number, signedTx: string) {
  const contract = await getErc20TokenContract(networkId, "");

  // Construct the evm wallet from the privateKey
  try {
    return await contract.provider.sendTransaction(signedTx);
  } catch (error) {
    const errorMessage = `Error sending signed transaction: ${error}`;
    throw new Error(errorMessage);
  }
}
