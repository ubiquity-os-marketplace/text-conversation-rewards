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

import { RequestError } from "@octokit/request-error";
import { createClient } from "@supabase/supabase-js";
import { Database, decodePermits } from "@ubiquity-os/permit-generation";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { GitHubIssueComment } from "../src/github-types";
import { IssueComment } from "@octokit/graphql-schema";
import { QUERY_COMMENT_DETAILS } from "../src/types/requests";

const _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_PRIVATE_KEY);
const _octokit = new customOctokit({ auth: process.env.GITHUB_TOKEN });

interface MinimalPermitReward {
  owner: string;
  tokenAddress: string;
  networkId: number;
}

// this is not part of core logic, so disabling lint is ok
// eslint-disable-next-line sonarjs/cognitive-complexity
async function backfillPermits() {
  const { data: permitsData } = await _supabase.from("permits").select("*");

  if (!permitsData) {
    console.log("No permits found");
    return;
  }

  console.log("Found ", permitsData.length, "permits");

  for (const permit of permitsData) {
    // skip if already properly filled
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
    if (!permit.signature) {
      console.log(`Permit ${permit.id}: missing a signature`);
      continue;
    }

    // fetch the user record
    const { data: userData, error: userError } = await _supabase
      .from("users")
      .select("id, wallet_id")
      .eq("id", permit.beneficiary_id)
      .single();
    if (userError || !userData?.wallet_id) {
      console.log(`Permit ${permit.id}: user ${permit.beneficiary_id} not found`);
      continue;
    }

    // fetch the user's wallet address
    const { data: userWalletData, error: userWalletError } = await _supabase
      .from("wallets")
      .select("address")
      .eq("id", userData.wallet_id)
      .single();
    if (userWalletError || !userWalletData?.address) {
      console.log(`Permit ${permit.id}: wallet for user ${permit.beneficiary_id} not found`);
      continue;
    }
    const userAddress = userWalletData.address;

    // fetch location to get the GitHub issue URL
    const { data: locationData } = await _supabase
      .from("locations")
      .select("node_url")
      .eq("id", permit.location_id)
      .single();
    if (!locationData?.node_url) {
      console.log(`Permit ${permit.id}: invalid node_url`);
      continue;
    }

    // parse out the GitHub issue details
    const match = locationData.node_url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (!match) {
      console.log(`Permit ${permit.id}: invalid location node_url: ${locationData.node_url}`);
      continue;
    }
    const [, repoOwner, repoName, issueNumber] = match;

    // pull comments from GitHub
    const comments = await fetchGithubComments(repoOwner, repoName, parseInt(issueNumber, 10));
    if (!comments) {
      console.log(`Permit ${permit.id}: Skipping due to GitHub fetch failure.`);
      return;
    }

    await getMinimizedCommentStatus(comments);

    // find a permit that matches this permit's signature and user address
    let matchedPermit: MinimalPermitReward | null = null;
    for (const comment of comments) {
      if (!comment.body) continue;
      matchedPermit = findMatchingPermitRewardInComment(comment.body, permit.signature, userAddress);
      if (matchedPermit) break;
    }

    if (!matchedPermit) {
      console.log(`Permit ${permit.id}: no matching reward found (signature: ${permit.signature})`);
      continue;
    }

    // proceed with backfilling
    const partnerWalletId = await getOrCreateWallet(matchedPermit.owner);
    if (!partnerWalletId) {
      console.error(`Permit ${permit.id}: could not get/create partner wallet`);
      continue;
    }

    const partnerId = await getOrCreatePartner(partnerWalletId);
    if (!partnerId) {
      console.error(`Permit ${permit.id}: could not get/create partner`);
      continue;
    }

    const tokenId = await getOrCreateToken(matchedPermit.tokenAddress, matchedPermit.networkId);
    if (!tokenId) {
      console.error(`Permit ${permit.id}: could not get/create token`);
      continue;
    }

    // update the permit
    const { error: updateError } = await _supabase
      .from("permits")
      .update({ partner_id: partnerId, token_id: tokenId })
      .eq("id", permit.id);
    if (updateError) {
      console.error(`Permit ${permit.id}: error updating permit`, updateError);
    } else {
      console.log(`Permit ${permit.id}: successfully backfilled!`);
    }
  }

  console.log("Finished backfilling permits");
}

// GitHub fetch with retry logic
async function fetchGithubComments(owner: string, repo: string, issueNumber: number): Promise<GitHubIssueComment[]> {
  try {
    return await _octokit.paginate(
      _octokit.rest.issues.listComments.endpoint.merge({
        owner,
        repo,
        issue_number: issueNumber,
      })
    );
  } catch (error) {
    if (error instanceof RequestError) {
      if (error.status === 404) {
        console.log(`GitHub ${owner + "/" + repo + "/issues/" + issueNumber} not found, skipping.`);
        return [];
      } else if (error.status === 403 && error.response && error.response.headers["x-ratelimit-remaining"] === "0") {
        const waitTime = parseInt(error.response.headers["x-ratelimit-reset"] ?? "2") * 1000 - Date.now();
        console.log(`GitHub API rate limit hit, waiting ${waitTime / 1000} seconds...`);
        await new Promise((res) => setTimeout(res, waitTime));
        return fetchGithubComments(owner, repo, issueNumber);
      }
      console.error(`Error fetching GitHub comments for issue ${issueNumber}:`, error);
      return [];
    }
  }
  return [];
}

// scans the comment for any "https://pay.ubq.fi/?claim=..." urls, decodes them,
// and looks for one whose signature == permitSignature and beneficiary == userAddress.
function findMatchingPermitRewardInComment(
  commentBody: string,
  permitSignature: string,
  userAddress: string
): MinimalPermitReward | null {
  // find all matches of pay.ubq.fi with a claim param
  // example: https://pay.ubq.fi/?claim=eyJ0b2tlbkFkZHJlc3MiOiJ...
  const regex = /https:\/\/pay\.ubq\.fi\/?\?claim=([A-Za-z0-9+/=_-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(commentBody)) !== null) {
    const encoded = match[1];
    try {
      // decodePermits typically returns an array of PermitReward
      const decodedList = decodePermits(encoded);
      for (const decoded of decodedList) {
        // check if this matches the permit's signature and the user address
        if (
          decoded.signature?.toLowerCase() === permitSignature.toLowerCase() &&
          decoded.beneficiary?.toLowerCase() === userAddress.toLowerCase()
        ) {
          return {
            owner: decoded.owner,
            tokenAddress: decoded.tokenAddress,
            networkId: decoded.networkId,
          };
        }
      }
    } catch (err) {
      console.error("Error decoding claim from comment", err);
    }
  }

  return null;
}

/**
 * attempts to find a wallet by address. ff none found, inserts a new wallet
 */
async function getOrCreateWallet(address: string): Promise<number | null> {
  // 1) try to find existing wallet
  const { data: existing, error: findError } = await _supabase
    .from("wallets")
    .select("id")
    .eq("address", address)
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
    .from("wallets")
    .insert({ address })
    .select("id")
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
    .from("partners")
    .select("id")
    .eq("wallet_id", walletId)
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
    .from("partners")
    .insert({ wallet_id: walletId })
    .select("id")
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
    .from("tokens")
    .select("id")
    .eq("address", address)
    .eq("network", network)
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
    .from("tokens")
    .insert({ address, network })
    .select("id")
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
