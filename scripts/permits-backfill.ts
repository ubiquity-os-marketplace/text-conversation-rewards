/*
* this is supposed to be executed as a standalone. the context behind this is: 
* as of 02/22/2025, the columns `token_id` and `partner_id` in our permits table 
* at supabase are empty. this means that we can't derive the chain id, token address, 
* nor permit owner from the db.
* 
* this script should not be needed once the following PR is merged. filling the columns
* https://github.com/ubiquity-os-marketplace/text-conversation-rewards/pull/285
* 
* context: https://github.com/ubiquity/pay.ubq.fi/issues/368
 */

import { createClient } from "@supabase/supabase-js";
import { Database, decodePermits } from "@ubiquity-os/permit-generation";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { GitHubIssueComment } from "../src/github-types";
import { IssueComment } from "@octokit/graphql-schema";
import { QUERY_COMMENT_DETAILS } from "../src/types/requests";

const _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const _octokit = new customOctokit({ auth: process.env.GITHUB_TOKEN });

/** 
 * minimal type with only the fields we need to backfill
 */
interface MinimalPermitReward {
  owner: string;
  tokenAddress: string;
  networkId: number;
}

/**
 * the structure of each array item in the *oldest* comment format. e.g https://github.com/ubiquity/work.ubq.fi/issues/20
 */
interface OldFormatItem {
  owner: string;
  networkId: number;
  permit: {
    permitted: {
      token: string;    // e.g., "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d"
      amount: string;   // e.g., "45000000000000000000"
    };
    nonce: string;
    deadline: string;
  };
  transferDetails: {
    to: string;         // e.g., "0x4007CE2083c7F3E18097aeB3A39bb8eC149a341d"
    requestedAmount: string;
  };
  signature: string;
}

async function backfillPermits() {
  const { data: permitsData } = await _supabase.from('permits').select('*');

  if (!permitsData) {
    console.log('No permits found');
    return;
  }

  console.log("Found permits", permitsData.length);

  for (const permit of permitsData) {
    // skip if already propperly filled
    if (permit.partner_id && permit.token_id) {
      console.log(`Permit ${permit.id}: already filled`);
      continue;
    }

    if (!permit.beneficiary_id) {
      console.log(`Permit ${permit.id}: missing a beneficiary_id`);
      continue;
    }

    if (!permit.location_id) {
      console.log(`Permit ${permit.id}: missing a location_id`);
      continue;
    }
    
    // fetch the user record using beneficiary_id.
    const { data: userData, error: userError } = await _supabase
      .from('users')
      .select('id, wallet_id')
      .eq('id', permit.beneficiary_id)
      .single();
    if (userError || !userData || !userData.wallet_id) {
      console.log(`Permit ${permit.id}: user ${permit.beneficiary_id} not found`);
      continue;
    }

    // with the user`s wallet_id, fetch the wallet address.
    const { data: userWalletData, error: userWalletError } = await _supabase
      .from('wallets')
      .select('address')
      .eq('id', userData.wallet_id)
      .single();
    if (userWalletError || !userWalletData || !userWalletData.address) {
      console.log(`Permit ${permit.id}: wallet for user ${permit.beneficiary_id} not found`);
      continue;
    }
    const userAddress = userWalletData.address;

    // fetch from locations table to extract the issue URL
    const { data: locationData } = await _supabase
      .from('locations')
      .select('node_url')
      .eq('id', permit.location_id)
      .single();
    if (!locationData || !locationData.node_url) {
      console.log(`Permit ${permit.id}: invalid node_url`);
      continue;
    }

    const match = locationData.node_url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (!match) {
      console.log(`Permit ${permit.id}: invalid location node_url: ${locationData.node_url}`);
      continue;
    }

    const [_, repoOwner, repoName, issueNumber] = match;
    const issueParams = {
      owner: repoOwner,
      repo: repoName,
      issue_number: parseInt(issueNumber, 10),
    };

    // pull comments from GitHub
    const comments: GitHubIssueComment[] = await _octokit.paginate(
      _octokit.rest.issues.listComments.endpoint.merge(issueParams)
    );
    await getMinimizedCommentStatus(comments);

    // try to find a matching "permit reward" in the comments
    let foundPermit: MinimalPermitReward | null = null;
    for (const comment of comments) {
      if (!comment.body) continue;
      foundPermit = await extractPermit(comment.body, permit.beneficiary_id, userAddress);
      if (foundPermit) break;
    }
    if (!foundPermit) {
      console.log(`Permit ${permit.id}: no matching reward found`);
      continue;
    }

    // create instances in db to backfill
    const partnerWalletId = await getOrCreateWallet(foundPermit.owner);
    if (!partnerWalletId) {
      console.error(`Permit ${permit.id}: could not get/create partner wallet`);
      continue;
    }

    const partnerId = await getOrCreatePartner(partnerWalletId);
    if (!partnerId) {
      console.error(`Permit ${permit.id}: could not get/create partner`);
      continue;
    }

    const tokenId = await getOrCreateToken(foundPermit.tokenAddress, foundPermit.networkId);
    if (!tokenId) {
      console.error(`Permit ${permit.id}: could not get/create token`);
      continue;
    }

    // update the permit in db
    const { error: updateError } = await _supabase
      .from('permits')
      .update({ partner_id: partnerId, token_id: tokenId })
      .eq('id', permit.id);
    if (updateError) {
      console.error(`Permit ${permit.id}: error updating permit`, updateError);
    } else {
      console.log(`Permit ${permit.id}: successfully backfilled!`);
    }
  }
}

/**
 * figures out whether this comment is in the "latest" or "oldest" format
 * and returns a MinimalPermitReward if found, otherwise null.
 */
async function extractPermit(
  commentBody: string,
  beneficiaryId: number,
  userAddress: string
): Promise<MinimalPermitReward | null> {
  const latestFormatMarker = "Ubiquity - GithubCommentModule - GithubCommentModule.getBodyContent";
  const oldestFormatMarker = "Ubiquity - Transactions - generatePermits -";

  if (commentBody.includes(latestFormatMarker)) {
    return extractFromLatestFormat(commentBody, beneficiaryId);
  } else if (commentBody.includes(oldestFormatMarker)) {
    return extractFromOldestFormat(commentBody, userAddress);
  }
  return null;
}

/**
 * for the *latest format*, we decode a base64 "claim" param from the permitUrl
 * and pick out the fields we need (owner, tokenAddress, networkId)
 */
function extractFromLatestFormat(
  commentBody: string,
  beneficiaryId: number
): MinimalPermitReward | null {
  const jsonMatch = commentBody.match(/<!--[\s\S]*?(\{[\s\S]+\})\s*-->/);
  if (!jsonMatch) {
    console.log("Latest format: didn't find JSON");
    return null;
  }
  try {
    const data = JSON.parse(jsonMatch[1]);
    const output = data.output;
    for (const user of Object.values(output)) {
      // we match the beneficiaryId to userId
      if ((user as any)?.userId === beneficiaryId) {
        const permitUrl = (user as any).permitUrl;
        const claimParam = new URL(permitUrl).searchParams.get('claim');
        if (!claimParam) {
          console.error("Latest format: Permit not found in URL", permitUrl);
          return null;
        }
        const [decoded] = decodePermits(claimParam);
        return {
          owner: decoded.owner,
          tokenAddress: decoded.tokenAddress,
          networkId: decoded.networkId,
        };
      }
    }
  } catch (e) {
    console.error("Latest format: JSON parsing error", e);
  }
  return null;
}

/**
 * for the *oldest format*, we have an array of objects (OldFormatItem[]).
 * we pick the one whose `transferDetails.to` matches the userAddress,
 * then return just the fields we need
 */
function extractFromOldestFormat(
  commentBody: string,
  userAddress: string
): MinimalPermitReward | null {
  const jsonMatch = commentBody.match(/<!--[\s\S]*?(\[[\s\S]+\])\s*-->/);
  if (!jsonMatch) {
    console.log("Oldest format: didn't find JSON array");
    return null;
  }
  try {
    const data: OldFormatItem[] = JSON.parse(jsonMatch[1]);
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // look for the item whose `transferDetails.to` matches the user
    const entry = data.find(
      (item) => item.transferDetails.to.toLowerCase() === userAddress.toLowerCase()
    );
    if (!entry) {
      console.error("Oldest format: Permit not found for user", userAddress);
      return null;
    }

    return {
      owner: entry.owner,
      tokenAddress: entry.permit.permitted.token,
      networkId: entry.networkId,
    };
  } catch (e) {
    console.error("Oldest format: JSON parsing error", e);
  }
  return null;
}

/**
 * attempts to find a wallet by address. ff none found, inserts a new wallet
 */
async function getOrCreateWallet(address: string): Promise<number | null> {
  // 1) try to find existing wallet
  const { data: existing, error: findError } = await _supabase
    .from('wallets')
    .select('id')
    .eq('address', address)
    .maybeSingle();

  if (findError) {
    console.error(`Error finding wallet with address ${address}`, findError);
    return null;
  }
  if (existing) {
    return existing.id;
  }

  // 2) insert new wallet
  const { data: inserted, error: insertError } = await _supabase
    .from('wallets')
    .insert({ address })
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error(`Error inserting new wallet with address ${address}`, insertError);
    return null;
  }
  return inserted.id;
}

/**
 * attempts to find a partner by wallet_id. if none found, inserts a new partner
 */
async function getOrCreatePartner(walletId: number): Promise<number | null> {
  // 1) try to find existing partner
  const { data: existing, error: findError } = await _supabase
    .from('partners')
    .select('id')
    .eq('wallet_id', walletId)
    .maybeSingle();

  if (findError) {
    console.error(`Error finding partner for wallet_id ${walletId}`, findError);
    return null;
  }
  if (existing) {
    return existing.id;
  }

  // 2) insert new partner
  const { data: inserted, error: insertError } = await _supabase
    .from('partners')
    .insert({ wallet_id: walletId })
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error(`Error inserting new partner for wallet_id ${walletId}`, insertError);
    return null;
  }
  return inserted.id;
}

/**
 * attempts to find a token by (address, network). if none found, inserts a new token
 */
async function getOrCreateToken(address: string, network: number): Promise<number | null> {
  // 1) try to find existing token
  const { data: existing, error: findError } = await _supabase
    .from('tokens')
    .select('id')
    .eq('address', address)
    .eq('network', network)
    .maybeSingle();

  if (findError) {
    console.error(`Error finding token with address ${address} and network ${network}`, findError);
    return null;
  }
  if (existing) {
    return existing.id;
  }

  // 2) insert new token
  const { data: inserted, error: insertError } = await _supabase
    .from('tokens')
    .insert({ address, network })
    .select('id')
    .single();
  if (insertError || !inserted) {
    console.error(`Error inserting new token with address ${address} and network ${network}`, insertError);
    return null;
  }
  return inserted.id;
}

export async function getMinimizedCommentStatus(comments: GitHubIssueComment[]) {
  // 100 is the maximum amount of nodes that can be passed to the gql request, anything above will crash it.
  const CHUNK_SIZE = 100;
  const commentNodes: IssueComment[] = [];

  for (let i = 0; i < comments.length; i += CHUNK_SIZE) {
    const chunk = comments.slice(i, i + CHUNK_SIZE);

    const commentsData = await _octokit.graphql<{ nodes?: IssueComment[] }>(QUERY_COMMENT_DETAILS, {
      node_ids: chunk.map((o) => o.node_id),
    });

    if (commentsData?.nodes?.length) {
      commentNodes.push(...commentsData.nodes);
    }
  }

  for (const commentNode of commentNodes) {
    const comment = comments.find((o) => o.node_id === commentNode.id);
    if (comment) {
      comment.isMinimized = commentNode.isMinimized;
    }
  }
}

backfillPermits().catch(console.error);
