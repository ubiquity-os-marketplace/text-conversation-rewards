import { decrypt, parseDecryptedPrivateKey } from "@ubiquity-os/permit-generation/utils";
import { ethers, utils } from "ethers";
import { ContextPlugin } from "../../src/types/plugin-input";

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
    { name: "nonce", type: "uint256" },
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
  permitRequests: {
    type: string;
    username: string;
    amount: number;
    tokenAddress: string;
  }[]
) {
  // @ts-expect-error adapters is not in the type
  const { amount, adapters, username } = permitRequests[0];
  const { config, payload } = context;
  const chainId = config.evmNetworkId;
  const privateKey = await getPrivateKey(context.config.evmPrivateEncrypted);
  const permit2Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
  const convertedAmount = utils.parseUnits(amount.toString(), 18);
  const deadline = new Date(0).getTime().toString();
  const spenderWallet = new ethers.Wallet(privateKey);
  const { data: userData } = await context.octokit.rest.users.getByUsername({ username });

  context.logger.info("Generating permit.", {
    username,
    amount,
    chainId,
  });

  if (!userData) {
    throw new Error(`GitHub user was not found for id ${username}`);
  }

  let nodeId = "";
  if ("issue" in payload) {
    nodeId = payload.issue.node_id;
  }
  // Had to truncate the nonce to fit in an uint48
  const nonce = BigInt(utils.keccak256(utils.toUtf8Bytes(`${userData.id}-${nodeId}`)));
  const walletAddress = await adapters.supabase.wallet.getWalletByUserId(userData.id);
  const permitSingle: PermitSingle = {
    details: {
      // token: config.permitRequests[0].tokenAddress,
      token: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
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
        // token: config.permitRequests[0].tokenAddress,
        token: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
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
  return [permit];
}

export function customEncodePermits(obj: object) {
  return Buffer.from(JSON.stringify(obj)).toString("base64");
}
