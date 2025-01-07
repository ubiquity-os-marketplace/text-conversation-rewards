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
import { IssueActivity } from "../issue-activity";
import { getRepo, parseGitHubUrl } from "../start";
import { EnvConfig } from "../types/env-type";
import { BaseModule } from "../types/module";
import { Result } from "../types/results";
import { isAdmin, isCollaborative } from "../helpers/checkers";
import { getFundingWalletBalance } from "../helpers/web3";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  erc20RewardToken: string;
  issue: { node_id: string };
}

export class PermitGenerationModule extends BaseModule {
  readonly _configuration: PermitGenerationConfiguration | null = this.context.config.incentives.permitGeneration;
  readonly _autoTransferMode: boolean = this.context.config.automaticTransferMode;
  readonly _fundingWalletAddress: string = this.context.config.fundingWalletAddress;
  readonly _evmNetworkId: number = this.context.config.evmNetworkId;
  readonly _erc20RewardToken: string = this.context.config.erc20RewardToken;
  readonly _supabase = createClient<Database>(this.context.env.SUPABASE_URL, this.context.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const canGeneratePermits = await this._canGeneratePermit(data);

    if (!canGeneratePermits) {
      this.context.logger.error("[PermitGenerationModule] Non collaborative issue detected, skipping.");
      return Promise.resolve(result);
    }

    const sumPayouts = await this._sumPayouts(result);
    const fundingWalletBalance = await getFundingWalletBalance(
      this._evmNetworkId,
      this._erc20RewardToken,
      this._fundingWalletAddress
    );

    if (this._autoTransferMode && sumPayouts < fundingWalletBalance) {
      this.context.logger.debug(
        "[PermitGenerationModule] AutoTransformMode is enabled, " +
          "and sufficient funds are available in the funding wallet, skipping."
      );
      return Promise.resolve(result);
    }

    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: this.context.payload.issue.html_url,
      evmPrivateEncrypted: this.context.config.evmPrivateEncrypted,
      evmNetworkId: this.context.config.evmNetworkId,
      erc20RewardToken: this.context.config.erc20RewardToken,
    };
    const issueId = Number(payload.issueUrl.match(/\d+$/)?.[0]);
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
    // apply fees
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

  async _sumPayouts(result: Result) {
    let sumPayouts = 0;
    for (const value of Object.values(result)) {
      sumPayouts += value.total;
    }
    return sumPayouts;
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
        console.error("Failed to create a new location", error);
      } else {
        locationId = newLocationData.id;
      }
    } else {
      locationId = locationData.id;
    }
    if (!locationId) {
      throw new Error(
        this.context.logger.error("Failed to retrieve the related location from issue", { issue }).logMessage.raw
      );
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
            amount: String(permit.amount),
            nonce: String(permit.nonce),
            deadline: String(permit.deadline),
            signature: permit.signature,
            beneficiary_id: userData.id,
            location_id: locationId,
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
      this.context.logger.error("Invalid / missing configuration detected for PermitGenerationModule, disabling.");
      return false;
    }
    return true;
  }
}
