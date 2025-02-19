import { createAdapters, decrypt, parseDecryptedPrivateKey } from "@ubiquity-os/permit-generation";
import { ethers, utils } from "ethers";
import { ContextPlugin } from "../types/plugin-input";

type PermitDetails = {
  token: string; // address
  amount: ethers.BigNumberish; // uint160
  expiration: string; // uint48
  nonce: ethers.BigNumberish; // uint48
};

type PermitSingle = {
  details: PermitDetails;
  spender: string; // address
  sigDeadline: ethers.BigNumberish; // uint256
};

// These are the EIP-712 type definitions from Uniswap's Permit2.
const permit2Types = {
  PermitSingle: [
    { name: "details", type: "PermitDetails" },
    { name: "spender", type: "address" },
    { name: "sigDeadline", type: "uint256" },
  ],
  PermitDetails: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint160" },
    { name: "expiration", type: "uint48" },
    { name: "nonce", type: "uint48" },
  ],
};

/**
 * signPermit2() generates an EIP-712 signature for Uniswap's Permit2.
 *
 * @param privateKey the private key of the signer
 * @param permit2Address the deployed Permit2 contract address
 * @param chainId the chain ID
 * @param permitSingle the permit data
 * @returns the signature string
 */
export async function signPermit2(
  privateKey: string,
  permit2Address: string,
  chainId: number,
  permitSingle: PermitSingle
): Promise<string> {
  const domainData = {
    name: "Permit2",
    version: "1",
    chainId,
    verifyingContract: permit2Address,
  };

  const wallet = new ethers.Wallet(privateKey);
  return wallet._signTypedData(domainData, permit2Types, permitSingle);
}

async function getPrivateKey(evmPrivateEncrypted: string) {
  try {
    const privateKeyDecrypted = await decrypt(evmPrivateEncrypted, String(process.env.X25519_PRIVATE_KEY));
    const privateKeyParsed = parseDecryptedPrivateKey(privateKeyDecrypted);
    const privateKey = privateKeyParsed.privateKey;
    if (!privateKey) throw new Error("Private key is not defined");
    return privateKey;
  } catch (error) {
    const errorMessage = `Failed to decrypt a private key: ${error}`;
    throw new Error(errorMessage);
  }
}

/**
 * Generates a claim base64 encoded compatible with pay.ubq.fi
 */
export async function generatePermitUrlPayload(
  context: ContextPlugin,
  userName: string,
  chainId: number,
  amount: number,
  erc20RewardToken: string,
  adapters: ReturnType<typeof createAdapters>
) {
  const privateKey = await getPrivateKey(context.config.evmPrivateEncrypted); // Replace with your private key
  const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Deployed Permit2 contract
  const convertedAmount = utils.parseUnits(amount.toString(), 18);
  const deadline = Date.now().toString();
  const spenderWallet = new ethers.Wallet(privateKey);
  const { data: userData } = await context.octokit.rest.users.getByUsername({ username: userName });

  context.logger.info("Generating permit.", {
    userName,
    amount,
    chainId,
  });

  if (!userData) {
    throw new Error(`GitHub user was not found for id ${userName}`);
  }

  // Had to truncate the nonce to fit in an uint48
  const nonce =
    BigInt(utils.keccak256(utils.toUtf8Bytes(`${userData.id}-${context.payload.issue.node_id}`))) % BigInt(2 ** 48);
  const walletAddress = await adapters.supabase.wallet.getWalletByUserId(userData.id);
  const permitSingle: PermitSingle = {
    details: {
      token: erc20RewardToken,
      amount: convertedAmount, // 1 token with 18 decimals
      expiration: deadline, // Unix timestamp
      nonce: nonce.toString(),
    },
    spender: spenderWallet.address,
    sigDeadline: deadline, // Unix timestamp
  };
  const signature = await signPermit2(privateKey, permit2Address, chainId, permitSingle);
  const permit = {
    type: "erc20-permit",
    permit: {
      permitted: {
        token: erc20RewardToken,
        amount: convertedAmount,
      },
      nonce: nonce.toString(),
      deadline: deadline,
    },
    transferDetails: {
      to: walletAddress,
      requestedAmount: convertedAmount,
    },
    owner: spenderWallet.address,
    signature: signature,
    networkId: chainId,
  };

  return Buffer.from(JSON.stringify([permit])).toString("base64");
}
