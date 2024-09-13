import { context } from "@actions/github";
import { Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import {
  Context,
  createAdapters,
  Database,
  encodePermits,
  generatePayoutPermit,
  PermitReward,
  SupportedEvents,
  TokenType,
} from "@ubiquibot/permit-generation/core";
import { decrypt, parseDecryptedPrivateKey } from "@ubiquibot/permit-generation/utils";
import Decimal from "decimal.js";
import configuration from "../configuration/config-reader";
import {
  PermitGenerationConfiguration,
  permitGenerationConfigurationType,
} from "../configuration/permit-generation-configuration";
import { getOctokitInstance } from "../octokit";
import { IssueActivity } from "../issue-activity";
import { getRepo, parseGitHubUrl } from "../start";
import envConfigSchema, { EnvConfigType } from "../types/env-type";
import program from "./command-line";
import { Module, Result } from "./processor";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  erc20RewardToken: string;
  issue: { node_id: string };
}

export class PermitGenerationModule implements Module {
  readonly _configuration: PermitGenerationConfiguration | null = configuration.incentives.permitGeneration;
  readonly _supabase = createClient<Database>(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: program.eventPayload.issue.html_url,
      evmPrivateEncrypted: configuration.evmPrivateEncrypted,
      evmNetworkId: configuration.evmNetworkId,
      erc20RewardToken: configuration.erc20RewardToken,
    };
    const issueId = Number(payload.issueUrl.match(/[0-9]+$/)?.[0]);
    payload.issue = {
      node_id: program.eventPayload.issue.node_id,
    };
    const env = Value.Default(envConfigSchema, process.env) as EnvConfigType;
    if (!Value.Check(envConfigSchema, env)) {
      console.warn("[PermitGenerationModule] Invalid env detected, skipping.");
      return Promise.resolve(result);
    }
    const isPrivateKeyAllowed = await this._isPrivateKeyAllowed(payload.evmPrivateEncrypted, program.eventPayload.organization?.id || 0, program.eventPayload.repository.id);
    if (!isPrivateKeyAllowed) {
      console.warn("[PermitGenerationModule] Private key is not allowed to be used in this organization/repository.");
      return Promise.resolve(result);
    }
    const eventName = context.eventName as SupportedEvents;
    const octokit = getOctokitInstance();
    const logger = {
      debug() {},
      error(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      fatal(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      info() {},
      warn(message: unknown, optionalParams: unknown) {
        console.warn(message, optionalParams);
      },
    };
    const adapters = {} as ReturnType<typeof createAdapters>;

    // apply fees
    result = await this._applyFees(result, payload.erc20RewardToken);

    for (const [key, value] of Object.entries(result)) {
      try {
        const config: Context["config"] = {
          evmNetworkId: payload.evmNetworkId,
          evmPrivateEncrypted: payload.evmPrivateEncrypted,
          permitRequests: [
            {
              amount: value.total,
              username: key,
              contributionType: "",
              type: TokenType.ERC20,
              tokenAddress: payload.erc20RewardToken,
            },
          ],
        };
        const permits = await generatePayoutPermit(
          {
            env,
            eventName,
            logger,
            payload,
            adapters: createAdapters(this._supabase, {
              env,
              eventName,
              octokit,
              config,
              logger,
              payload,
              adapters,
            }),
            octokit,
            config,
          },
          config.permitRequests
        );
        result[key].permitUrl = `https://pay.ubq.fi?claim=${encodePermits(permits)}`;
        await this._savePermitsToDatabase(result[key].userId, { issueUrl: payload.issueUrl, issueId }, permits);
      } catch (e) {
        console.error(e);
      }
    }

    // remove treasury item from final result in order not to display permit fee in github comments
    if (process.env.PERMIT_TREASURY_GITHUB_USERNAME) delete result[process.env.PERMIT_TREASURY_GITHUB_USERNAME];

    return result;
  }

  /**
   * Applies fees to the final result.
   * How it works:
   * 1. Fee (read from ENV variable) is subtracted from all of the final result items (user.total, user.task.reward, user.comments[].reward)
   * 2. Total fee is calculated
   * 3. A new item is added to the final result object, example:
   * ```
   * {
   *   ...other items
   *   "ubiquibot-treasury": {
   *     total: 10.00,
   *     userId: 1
   *   }
   * }
   * ```
   * This method is meant to be called before the final permit generation.
   * @param result Result object
   * @param erc20RewardToken ERC20 address of the reward token
   * @returns Result object
   */
  async _applyFees(result: Result, erc20RewardToken: string): Promise<Result> {
    // validate fee related env variables
    if (!process.env.PERMIT_FEE_RATE || +process.env.PERMIT_FEE_RATE === 0) {
      console.log("PERMIT_FEE_RATE is not set, skipping permit fee generation");
      return result;
    }
    if (!process.env.PERMIT_TREASURY_GITHUB_USERNAME) {
      console.log("PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation");
      return result;
    }
    if (process.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST) {
      const erc20TokensNoFee = process.env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST.split(",");
      if (erc20TokensNoFee.includes(erc20RewardToken)) {
        console.log(`Token address ${erc20RewardToken} is whitelisted to be fee free, skipping permit fee generation`);
        return result;
      }
    }

    // Get treasury github user id
    const octokit = getOctokitInstance();
    const { data: treasuryGithubData } = await octokit.users.getByUsername({
      username: process.env.PERMIT_TREASURY_GITHUB_USERNAME,
    });
    if (!treasuryGithubData) {
      console.log(
        `GitHub user was not found for username ${process.env.PERMIT_TREASURY_GITHUB_USERNAME}, skipping permit fee generation`
      );
      return result;
    }

    // Subtract fees from the final result:
    // - user.total
    // - user.task.reward
    // - user.comments[].reward
    const feeRateDecimal = new Decimal(100).minus(process.env.PERMIT_FEE_RATE).div(100);
    let permitFeeAmountDecimal = new Decimal(0);
    for (const [_, rewardResult] of Object.entries(result)) {
      // accumulate total permit fee amount
      const totalAfterFee = new Decimal(rewardResult.total).mul(feeRateDecimal).toNumber();
      permitFeeAmountDecimal = permitFeeAmountDecimal.add(new Decimal(rewardResult.total).minus(totalAfterFee));
      // subtract fees
      rewardResult.total = +totalAfterFee.toFixed(2);
      if (rewardResult.task) {
        rewardResult.task.reward = Number(new Decimal(rewardResult.task.reward).mul(feeRateDecimal).toFixed(2));
      }
      if (rewardResult.comments) {
        for (const comment of rewardResult.comments) {
          if (comment.score) {
            comment.score.reward = Number(new Decimal(comment.score.reward).mul(feeRateDecimal).toFixed(2));
          }
        }
      }
    }

    // Add a new result item for treasury
    result[process.env.PERMIT_TREASURY_GITHUB_USERNAME] = {
      total: +permitFeeAmountDecimal.toFixed(2),
      userId: treasuryGithubData.id,
    };

    return result;
  }

  async _getOrCreateIssueLocation(issue: { issueId: number; issueUrl: string }) {
    let locationId: number | null = null;

    const { data: locationData } = await this._supabase
      .from("locations")
      .select("id")
      .eq("issue_id", issue.issueId)
      .eq("node_url", issue.issueUrl)
      .single();

    if (!locationData) {
      const issueItem = await getRepo(parseGitHubUrl(issue.issueUrl));
      const { data: newLocationData, error } = await this._supabase
        .from("locations")
        .insert({
          node_url: issue.issueUrl,
          issue_id: issue.issueId,
          node_type: "Issue",
          repository_id: issueItem.id,
        })
        .select("id")
        .single();
      if (!newLocationData || error) {
        console.error("Failed to create a new location", error);
      } else {
        locationId = newLocationData.id;
      }
    } else {
      locationId = locationData.id;
    }
    if (!locationId) {
      throw new Error(`Failed to retrieve the related location from issue ${issue}`);
    }
    return locationId;
  }

  async _savePermitsToDatabase(userId: number, issue: { issueId: number; issueUrl: string }, permits: PermitReward[]) {
    for (const permit of permits) {
      try {
        const { data: userData } = await this._supabase.from("users").select("id").eq("id", userId).single();
        const locationId = await this._getOrCreateIssueLocation(issue);

        if (userData) {
          const { error } = await this._supabase.from("permits").insert({
            amount: permit.amount.toString(),
            nonce: permit.nonce.toString(),
            deadline: permit.deadline.toString(),
            signature: permit.signature,
            beneficiary_id: userData.id,
            location_id: locationId,
          });
          if (error) {
            console.error("Failed to insert a new permit", error);
          }
        } else {
          console.error(`Failed to save the permit: could not find user ${userId}`);
        }
      } catch (e) {
        console.error("Failed to save permits to the database", e);
      }
    }
  }

  /**
   * Checks whether partner's private key is allowed to be used in current repository.
   * 
   * If partner accidentally shares his encrypted private key then a malicious user
   * will be able to use that leaked private key in another organization with permits
   * generated from a leaked partner's wallet.
   * 
   * Partner private key (`evmPrivateEncrypted` config param in `conversation-rewards` plugin) supports 2 formats:
   * 1. PRIVATE_KEY:GITHUB_ORGANIZATION_ID
   * 2. PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID
   * 
   * Format "PRIVATE_KEY:GITHUB_ORGANIZATION_ID" restricts in which particular organization this private
   * key can be used. It can be set either in the organization wide config either in the repository wide one.
   * 
   * Format "PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID" restricts organization and a particular 
   * repository where private key is allowed to be used.
   * 
   * @param privateKeyEncrypted Encrypted private key (with "X25519_PRIVATE_KEY") string (in any of the 2 different formats) 
   * @param githubContextOrganizationId Github organization id from which the "conversation-rewards" is executed
   * @param githubContextRepositoryId Github repository id from which the "conversation-rewards" is executed
   * @returns Whether private key is allowed to be used in current organization/repository context
   */
  async _isPrivateKeyAllowed(
    privateKeyEncrypted: string, 
    githubContextOrganizationId: number, 
    githubContextRepositoryId: number
  ): Promise<boolean> {
    // decrypt private key
    const privateKeyDecrypted = await decrypt(privateKeyEncrypted, process.env.X25519_PRIVATE_KEY);
    
    // parse decrypted private key
    const privateKeyParsed = parseDecryptedPrivateKey(privateKeyDecrypted);
    if (!privateKeyParsed.privateKey) {
      console.log("Private key could not be decrypted");
      return false;
    }

    console.log('===here===', privateKeyParsed.privateKey);

    // private key + organization id
    // Format: PRIVATE_KEY:GITHUB_ORGANIZATION_ID
    if (privateKeyParsed.allowedOrganizationId && !privateKeyParsed.allowedRepositoryId) {
      if (privateKeyParsed.allowedOrganizationId !== githubContextOrganizationId) {
        console.log(`Current organization id ${githubContextOrganizationId} is not allowed to use this private key`);
        return false;
      }
      return true;
    }

    // private key + organization id + repository id
    // Format: PRIVATE_KEY:GITHUB_ORGANIZATION_ID:GITHUB_REPOSITORY_ID
    if (privateKeyParsed.allowedOrganizationId && privateKeyParsed.allowedRepositoryId) {
      if (privateKeyParsed.allowedOrganizationId !== githubContextOrganizationId || privateKeyParsed.allowedRepositoryId !== githubContextRepositoryId) {
        console.log(`Current organization id ${githubContextOrganizationId} and repository id ${githubContextRepositoryId} are not allowed to use this private key`);
        return false;
      }
      return true;
    }

    // otherwise invalid private key format
    console.log("Invalid private key format");
    return false;
  }

  get enabled(): boolean {
    if (!Value.Check(permitGenerationConfigurationType, this._configuration)) {
      console.warn("Invalid / missing configuration detected for PermitGenerationModule, disabling.");
      return false;
    }
    return true;
  }
}
