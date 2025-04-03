import { context } from "@actions/github";
import { RestEndpointMethodTypes } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { createClient } from "@supabase/supabase-js";
import {
  Context,
  createAdapters,
  Database,
  decrypt,
  encodePermits,
  generatePayoutPermit,
  parseDecryptedPrivateKey,
  PermitReward,
  SupportedEvents,
  TokenType,
} from "@ubiquity-os/permit-generation";
import Decimal from "decimal.js";
import {
  PermitGenerationConfiguration,
  permitGenerationConfigurationType,
} from "../configuration/permit-generation-configuration";
import { isAdmin, isCollaborative } from "../helpers/checkers";
import { IssueActivity } from "../issue-activity";
import { getRepo, parseGitHubUrl } from "../start";
import { EnvConfig } from "../types/env-type";
import { BaseModule } from "../types/module";
import { Result } from "../types/results";
import { utils } from "ethers";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  erc20RewardToken: string;
  issue: { node_id: string };
}

export class PermitGenerationModule extends BaseModule {
  readonly _configuration: PermitGenerationConfiguration | null = this.context.config.incentives.permitGeneration;
  readonly _supabase = createClient<Database>(this.context.env.SUPABASE_URL, this.context.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const canGeneratePermits = await this._canGeneratePermit(data);

    if (!canGeneratePermits) {
      this.context.logger.error("[PermitGenerationModule] Non collaborative issue detected, skipping.");
      return Promise.resolve(result);
    }

    if (!this.context.config.permits) {
      this.context.logger.info("No permit settings found, switching to XP recording mode.");
      return this._handleXpRecording(result);
    }

    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: this.context.payload.issue.html_url,
      evmPrivateEncrypted: this.context.config.permits.evmPrivateEncrypted,
      evmNetworkId: this.context.config.permits.evmNetworkId,
      erc20RewardToken: this.context.config.permits.erc20RewardToken,
    };
    const issueId = Number(RegExp(/\d+$/).exec(payload.issueUrl)?.[0]);
    payload.issue = {
      node_id: this.context.payload.issue.node_id,
    };
    const env = this.context.env;
    const isPrivateKeyAllowed = await this._isPrivateKeyAllowed(
      payload.evmPrivateEncrypted,
      this.context.payload.repository.owner.id,
      this.context.payload.repository.id,
      env
    );
    if (!isPrivateKeyAllowed) {
      this.context.logger.error(
        "[PermitGenerationModule] Private key is not allowed to be used in this organization/repository."
      );
      return Promise.resolve(result);
    }
    const eventName = context.eventName as SupportedEvents;
    const octokit = this.context.octokit as unknown as Context["octokit"];
    const permitLogger = {
      debug(message: unknown, optionalParams: unknown) {
        console.log(message, optionalParams);
      },
      error(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      fatal(message: unknown, optionalParams: unknown) {
        console.error(message, optionalParams);
      },
      info(message: unknown, optionalParams: unknown) {
        console.log(message, optionalParams);
      },
      warn(message: unknown, optionalParams: unknown) {
        console.warn(message, optionalParams);
      },
    };
    const adapters = {} as ReturnType<typeof createAdapters>;

    this.context.logger.info("Will attempt to apply fees...");
    result = await this._applyFees(result, payload.erc20RewardToken);

    for (const [key, value] of Object.entries(result)) {
      this.context.logger.debug(`Updating result for user ${key}`);
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
            logger: permitLogger,
            payload,
            adapters: createAdapters(this._supabase, {
              env,
              eventName,
              octokit,
              config,
              logger: permitLogger,
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
        this.context.logger.error(`[PermitGenerationModule] Failed to generate permits for user ${key}`, { e });
      }
    }

    // remove treasury item from final result in order not to display permit fee in GitHub comments
    if (env.PERMIT_TREASURY_GITHUB_USERNAME) delete result[env.PERMIT_TREASURY_GITHUB_USERNAME];

    return result;
  }

  /**
   * Applies fees to the final result.
   * How it works:
   * 1. Fee (read from ENV variable) is subtracted from all the final result items (user.total, user.task.reward, user.comments[].reward)
   * 2. Total fee is calculated
   * 3. A new item is added to the final result object, example:
   * ```
   * {
   *   ...other items
   *   "ubiquity-os-treasury": {
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
    const env = this.context.env;
    // validate fee related env variables
    if (!env.PERMIT_FEE_RATE || Number(env.PERMIT_FEE_RATE) === 0) {
      this.context.logger.info("PERMIT_FEE_RATE is not set, skipping permit fee generation");
      return result;
    }
    if (!env.PERMIT_TREASURY_GITHUB_USERNAME) {
      this.context.logger.info("PERMIT_TREASURY_GITHUB_USERNAME is not set, skipping permit fee generation");
      return result;
    }
    if (env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST) {
      const erc20TokensNoFee = env.PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST.split(",");
      if (erc20TokensNoFee.includes(erc20RewardToken)) {
        this.context.logger.info(
          `Token address ${erc20RewardToken} is whitelisted to be fee free, skipping permit fee generation`
        );
        return result;
      }
    }

    // Get treasury GitHub user id
    const octokit = this.context.octokit;
    const { data: treasuryGithubData } = await octokit.rest.users.getByUsername({
      username: env.PERMIT_TREASURY_GITHUB_USERNAME,
    });
    if (!treasuryGithubData) {
      this.context.logger.info(
        `GitHub user was not found for username ${env.PERMIT_TREASURY_GITHUB_USERNAME}, skipping permit fee generation`
      );
      return result;
    }

    return this._deductFeeFromReward(result, treasuryGithubData);
  }

  async _canGeneratePermit(data: Readonly<IssueActivity>) {
    if (!data.self?.closed_by || !data.self.user) return false;

    if (await isAdmin(data.self.user.login, this.context)) return true;

    return isCollaborative(data);
  }

  _deductFeeFromReward(
    result: Result,
    treasuryGithubData: RestEndpointMethodTypes["users"]["getByUsername"]["response"]["data"]
  ) {
    const env = this.context.env;
    // Subtract fees from the final result:
    // - user.total
    // - user.task.reward
    // - user.comments[].reward
    const feeRateDecimal = new Decimal(100).minus(env.PERMIT_FEE_RATE).div(100);
    let permitFeeAmountDecimal = new Decimal(0);
    for (const [key, rewardResult] of Object.entries(result)) {
      // accumulate total permit fee amount
      const totalAfterFee = new Decimal(rewardResult.total).mul(feeRateDecimal).toNumber();
      permitFeeAmountDecimal = permitFeeAmountDecimal.add(new Decimal(rewardResult.total).minus(totalAfterFee));
      // subtract fees
      result[key].total = Number(totalAfterFee.toFixed(2));
      result[key].feeRate = feeRateDecimal.toNumber();
      if (result[key].task) {
        result[key].task.reward = Number(new Decimal(result[key].task.reward).mul(feeRateDecimal).toFixed(2));
      }
      if (result[key].comments) {
        for (const comment of result[key].comments) {
          if (comment.score) {
            comment.score.reward = Number(new Decimal(comment.score.reward).mul(feeRateDecimal).toFixed(2));
          }
        }
      }
    }

    // Add a new result item for treasury
    result[env.PERMIT_TREASURY_GITHUB_USERNAME] = {
      total: Number(permitFeeAmountDecimal.toFixed(2)),
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
      const issueItem = await getRepo(this.context, parseGitHubUrl(issue.issueUrl));
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
        this.context.logger.error("Failed to create a new location", error);
      } else {
        locationId = newLocationData.id;
      }
    } else {
      locationId = locationData.id;
    }
    if (!locationId) {
      throw this.context.logger.error("Failed to retrieve the related location from issue", { issue });
    }
    return locationId;
  }

  async _getOrCreateToken(address: string, network: number) {
    let tokenId: number | null = null;

    const { data: tokenData } = await this._supabase
      .from("tokens")
      .select("id")
      .eq("address", address)
      .eq("network", network)
      .single();

    if (!tokenData) {
      const { data: insertedToken, error } = await this._supabase
        .from("tokens")
        .insert({
          address,
          network,
        })
        .select("id")
        .single();

      if (error || !insertedToken) {
        this.context.logger.error("Failed to insert a new token:", error);
      } else {
        tokenId = insertedToken.id;
      }
    } else {
      tokenId = tokenData.id;
    }
    if (!tokenId) {
      throw this.context.logger.error("Failed to retrieve the related token from permit", {
        address,
        network,
      });
    }

    return tokenId;
  }

  async _getOrCreatePartner(address: string) {
    let walletId: number | null = null;
    let partnerId: number | null = null;

    const { data: walletData } = await this._supabase.from("wallets").select("id").eq("address", address).single();

    if (!walletData) {
      const { data: insertedWallet, error } = await this._supabase
        .from("wallets")
        .insert({
          address,
        })
        .select("id")
        .single();

      if (error || !insertedWallet) {
        this.context.logger.error("Failed to insert a new wallet:", error);
      } else {
        walletId = insertedWallet.id;
      }
    } else {
      walletId = walletData.id;
    }
    if (!walletId) {
      throw this.context.logger.error("Failed to retrieve the related wallet from permit", { address });
    }

    const { data: partnerData } = await this._supabase.from("partners").select("id").eq("wallet_id", walletId).single();

    if (!partnerData) {
      const { data: insertedPartner, error } = await this._supabase
        .from("partners")
        .insert({
          wallet_id: walletId,
        })
        .select("id")
        .single();

      if (error || !insertedPartner) {
        this.context.logger.error("Failed to insert a new token:", error);
      } else {
        partnerId = insertedPartner.id;
      }
    } else {
      partnerId = partnerData.id;
    }
    if (!partnerId) {
      throw this.context.logger.error("Failed to retrieve the related partner from permit", { address });
    }

    return partnerId;
  }

  async _savePermitsToDatabase(userId: number, issue: { issueId: number; issueUrl: string }, permits: PermitReward[]) {
    for (const permit of permits) {
      try {
        const { data: userData } = await this._supabase.from("users").select("id").eq("id", userId).single();
        const locationId = await this._getOrCreateIssueLocation(issue);
        const tokenId = await this._getOrCreateToken(permit.tokenAddress, permit.networkId);
        const partnerId = await this._getOrCreatePartner(permit.owner);

        if (userData) {
          const { error } = await this._supabase.from("permits").insert({
            amount: String(permit.amount),
            nonce: String(permit.nonce),
            deadline: String(permit.deadline),
            signature: permit.signature,
            beneficiary_id: userData.id,
            location_id: locationId,
            token_id: tokenId,
            partner_id: partnerId,
          });
          if (error) {
            this.context.logger.error("Failed to insert a new permit", error);
          }
        } else {
          this.context.logger.error(`Failed to save the permit: could not find user ${userId}`);
        }
      } catch (e) {
        this.context.logger.error("Failed to save permits to the database", { e });
      }
    }
  }

  async _saveXPRecord(userId: number, issue: { issueId: number; issueUrl: string }, numericAmount: number) {
    this.context.logger.info(
      `Attempting to save XP for userId: ${userId}, issueId: ${issue.issueId}, amount: ${numericAmount}`
    );
    try {
      const { data: userData, error: userError } = await this._supabase
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();
      if (userError || !userData) {
        throw this.context.logger.error(`Failed to find user with ID ${userId} in database.`, { userError });
      }
      const beneficiaryId = userData.id;
      const locationId = await this._getOrCreateIssueLocation(issue);
      const amountString = new Decimal(numericAmount).mul(new Decimal(10).pow(18)).toFixed();

      const { data: existingXp, error: duplicateCheckError } = await this._supabase
        .from("permits")
        .select("id")
        .eq("beneficiary_id", beneficiaryId)
        .eq("location_id", locationId)
        .is("token_id", null)
        .maybeSingle();

      if (duplicateCheckError) {
        throw this.context.logger.error("Error checking for duplicate XP records", { duplicateCheckError });
      }

      if (existingXp) {
        this.context.logger.info(
          `Existing XP record found for userId ${userId} on issue ${issue.issueId}. Updating amount.`
        );
        const { error: updateError } = await this._supabase
          .from("permits")
          .update({ amount: amountString })
          .eq("id", existingXp.id);

        if (updateError) {
          throw this.context.logger.error("Failed to update XP record in database", { updateError });
        }
        this.context.logger.ok(`XP record updated successfully for userId: ${userId}, issueId: ${issue.issueId}`);
      } else {
        const insertData: Database["public"]["Tables"]["permits"]["Insert"] = {
          amount: amountString,
          beneficiary_id: beneficiaryId,
          location_id: locationId,
          token_id: null,
          nonce: BigInt(utils.keccak256(utils.toUtf8Bytes(`${userId}-${issue.issueId}`))).toString(),
          deadline: "",
          signature: "",
          partner_id: null,
        };
        const { error: insertError } = await this._supabase.from("permits").insert(insertData);

        if (insertError) {
          throw this.context.logger.error("Failed to insert XP record into database", { insertError });
        }
        this.context.logger.ok(`XP record inserted successfully for userId: ${userId}, issueId: ${issue.issueId}`);
      }
    } catch (e) {
      this.context.logger.error("An error occurred in _saveXPRecord", { e });
      throw e;
    }
  }

  async _handleXpRecording(result: Result): Promise<Result> {
    const issueUrl = this.context.payload.issue.html_url;
    const { issue_number: issueId } = parseGitHubUrl(issueUrl);
    if (!issueId) {
      this.context.logger.error("[PermitGenerationModule] Could not extract issue ID from URL for XP recording.", {
        issueUrl,
      });
      return result;
    }
    const issueDetails = { issueUrl, issueId };

    for (const [key, value] of Object.entries(result)) {
      if (key === this.context.env.PERMIT_TREASURY_GITHUB_USERNAME) {
        this.context.logger.debug("Skipping XP recording for treasury user.");
        continue;
      }
      if (!value.userId) {
        this.context.logger.error(`[PermitGenerationModule] Missing userId for user ${key}, cannot record XP.`);
        continue;
      }

      try {
        await this._saveXPRecord(value.userId, issueDetails, value.total);
        this.context.logger.ok(`Successfully recorded XP for user ${key} (ID: ${value.userId})`);
      } catch (e) {
        this.context.logger.error(`[PermitGenerationModule] Failed to record XP for user ${key}`, { e });
      }
    }

    if (this.context.env.PERMIT_TREASURY_GITHUB_USERNAME) {
      delete result[this.context.env.PERMIT_TREASURY_GITHUB_USERNAME];
    }

    return result;
  }

  /**
   * Checks whether partner's private key is allowed to be used in current repository.
   *
   * If partner accidentally shares his encrypted private key then a malicious user
   * will be able to use that leaked private key in another organization with permits
   * generated from a leaked partner's wallet.
   *
   * Partner private key (`evmPrivateEncrypted` config param in `conversation-rewards` plugin) supports 2 formats:
   * 1. PRIVATE_KEY:GITHUB_OWNER_ID
   * 2. PRIVATE_KEY:GITHUB_OWNER_ID:GITHUB_REPOSITORY_ID
   *
   * Here `GITHUB_OWNER_ID` can be:
   * 1. GitHub organization id (if ubiquity-os is used within an organization)
   * 2. GitHub user id (if ubiquity-os is simply installed in a user's repository)
   *
   * Format "PRIVATE_KEY:GITHUB_OWNER_ID" restricts in which particular organization (or user related repositories)
   * this private key can be used. It can be set either in the organization wide config either in the repository wide one.
   *
   * Format "PRIVATE_KEY:GITHUB_OWNER_ID:GITHUB_REPOSITORY_ID" restricts organization (or user related repositories) and
   * a particular repository where private key is allowed to be used.
   *
   * @param privateKeyEncrypted Encrypted private key (with "X25519_PRIVATE_KEY") string (in any of the 2 different formats)
   * @param githubContextOwnerId Github organization or used id from which the "conversation-rewards" is executed
   * @param githubContextRepositoryId Github repository id from which the "conversation-rewards" is executed
   * @param env The current environment used by the plugin
   * @returns Whether private key is allowed to be used in current owner/repository context
   */
  async _isPrivateKeyAllowed(
    privateKeyEncrypted: string,
    githubContextOwnerId: number,
    githubContextRepositoryId: number,
    env: EnvConfig
  ): Promise<boolean> {
    // decrypt private key
    const privateKeyDecrypted = await decrypt(privateKeyEncrypted, env.X25519_PRIVATE_KEY);

    // parse decrypted private key
    const privateKeyParsed = parseDecryptedPrivateKey(privateKeyDecrypted);
    if (!privateKeyParsed.privateKey) {
      this.context.logger.error("Private key could not be decrypted");
      return false;
    }

    // private key + owner id
    // Format: PRIVATE_KEY:GITHUB_OWNER_ID
    if (privateKeyParsed.allowedOrganizationId && !privateKeyParsed.allowedRepositoryId) {
      if (privateKeyParsed.allowedOrganizationId !== githubContextOwnerId) {
        this.context.logger.info(
          `Current organization/user id ${githubContextOwnerId} is not allowed to use this private key`
        );
        return false;
      }
      return true;
    }

    // private key + owner id + repository id
    // Format: PRIVATE_KEY:GITHUB_OWNER_ID:GITHUB_REPOSITORY_ID
    if (privateKeyParsed.allowedOrganizationId && privateKeyParsed.allowedRepositoryId) {
      if (
        privateKeyParsed.allowedOrganizationId !== githubContextOwnerId ||
        privateKeyParsed.allowedRepositoryId !== githubContextRepositoryId
      ) {
        this.context.logger.info(
          `Current organization/user id ${githubContextOwnerId} and repository id ${githubContextRepositoryId} are not allowed to use this private key`
        );
        return false;
      }
      return true;
    }

    // otherwise invalid private key format
    this.context.logger.error("Invalid private key format");
    return false;
  }

  get enabled(): boolean {
    if (!Value.Check(permitGenerationConfigurationType, this._configuration)) {
      this.context.logger.warn(
        "The configuration for the module PermitGenerationModule is invalid or missing, disabling."
      );
      return false;
    }
    return true;
  }
}
