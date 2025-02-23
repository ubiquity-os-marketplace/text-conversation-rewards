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
import { Database, decodePermits, PermitReward } from "@ubiquity-os/permit-generation";
import { customOctokit } from "@ubiquity-os/plugin-sdk/octokit";
import { GitHubIssueComment } from "../src/github-types";
import { IssueComment } from "@octokit/graphql-schema";
import { QUERY_COMMENT_DETAILS } from "../src/types/requests";

const _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const _octokit = new customOctokit({ auth: process.env.GITHUB_TOKEN });

async function backfillPermits() {
  const { data: permitsData } = await _supabase.from('permits').select('*');

  if (!permitsData) {
    console.log('No permits found');
    return;
  }

  console.log("Found permits", permitsData.length);

  for (const permit of permitsData) {
    // if the permit does not have partner or token id, we need to backfill from location
    if (permit.partner_id && permit.token_id) {
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

    const { data: locationData } = await _supabase.from('locations').select('*').eq('id', permit.location_id).single();
    if (!locationData || !locationData.node_url) {
      console.log(`Permit ${permit.id}: location ${permit.location_id} not found or invalid node_url`);
      continue;
    }

    const match = locationData.node_url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
    if (!match) {
      console.log(`Permit ${permit.id}: invalid location node_url: ${locationData.node_url}`);
      continue;
    }

    const [, owner, repo, issueNumber] = match;

    const issueParams = {
      owner,
      repo,
      issueNumber: parseInt(issueNumber, 10),
    };

    const comments: GitHubIssueComment[] = await _octokit.paginate(
      _octokit.rest.issues.listComments.endpoint.merge(issueParams)
    );
    await getMinimizedCommentStatus(comments);
    
    // iterate over comments to extract the permitUrl based on beneficiary_id.
    let foundPermitReward: PermitReward | null = null;
    for (const comment of comments) {
      if (!comment.body) continue;
      foundPermitReward = extractPermitFromRewardComment(comment.body, permit.beneficiary_id);
      if (foundPermitReward) break;
    }
    if (!foundPermitReward) {
      console.log(`Permit${permit.id}: no matching reward found for permit`);
      continue;
    }

    // find or create a partner wallet 
    const { data: partnerWalletData, error: partnerWalletError } = await _supabase.from('wallets').upsert({
      address: foundPermitReward.owner,
    }).select('id').single();
    if (partnerWalletError || !partnerWalletData) {
      console.error(`Permit ${permit.id}: error upserting wallet`, partnerWalletError);
      continue;
    }
    const partnerWalletId = partnerWalletData.id;

    // find or create a partner
    const { data: partnerData, error: partnerError } = await _supabase.from('partners').upsert({
      wallet_id: partnerWalletId,
    }).select('id').single();
    if (partnerError || !partnerData) {
      console.error(`Permit ${permit.id}: error upserting partner`, partnerError);
      continue;
    }

    // find or create a token
    const { data: tokenData, error: tokenError } = await _supabase.from('tokens').upsert({
      address: foundPermitReward.tokenAddress,
      network: foundPermitReward.networkId
    }).select('id').single();
    if (tokenError || !tokenData) {
      console.error(`Permit ${permit.id}: error upserting token`, tokenError);
      continue;
    }

    // update the permit with the backfilled partner_id and token_id
    const { error: updateError } = await _supabase.from('permits').update({
      partner_id: partnerData.id,
      token_id: tokenData.id,
    }).eq('id', permit.id);
    if (updateError) {
      console.error(`Permit ${permit.id}: error updating permit}`, updateError);
    } else {
      console.log(`Permit ${permit.id}: successfully backfilled!`);
    }
  }
}

function extractPermitFromRewardComment(commentBody: string, beneficiaryId: number): PermitReward | null {
	// latest format
  if (commentBody.includes("Ubiquity - GithubCommentModule - GithubCommentModule.getBodyContent")) {
    // use regex to extract reward JSON from comment 
    const jsonMatch = commentBody.match(/<!--[\s\S]*?(\{[\s\S]+\})\s*-->/);
    if (!jsonMatch){
      console.log("latest format: didn't find JSON");
      return null;
    } 
    try {
      const data = JSON.parse(jsonMatch[1]);
      const output = data.output;
      for (const user in output) {
        if (output[user]?.userId === beneficiaryId) {
          const permitUrl = output[user].permitUrl;
          const claimParam = new URL(permitUrl).searchParams.get('claim');
          const encoded64Permit = claimParam;
          if(!encoded64Permit) {
            console.error("Permit not found in URL", permitUrl);
            return null;
          }
          return decodePermits(encoded64Permit)[0];
        }
      }
    } catch (e) {
      console.error("JSON parsing error", e);
    }
    return null;
  }

  // oldest format
  if (commentBody.includes("Ubiquity - Transactions - generatePermits")) {

  }

  return null;
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