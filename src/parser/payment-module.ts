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
import { BaseModule } from "../types/module";
import { Result } from "../types/results";
import { isAdmin, isCollaborative } from "../helpers/checkers";
import { getNetworkExplorer, NetworkId } from "@ubiquity-dao/rpc-handler";
import {
  Erc20Wrapper,
  getContract,
  getEvmWallet,
  Permit2Wrapper,
  BatchTransferPermit,
  PERMIT2_ABI,
} from "../helpers/web3";
import { BigNumber, ethers, utils } from "ethers";
import { permit2Address } from "@uniswap/permit2-sdk";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  erc20RewardToken: string;
  issue: { node_id: string };
}

interface Beneficiaries {
  usernames: string[];
  addresses: string[];
  amounts: BigNumber[];
}

export class PaymentModule extends BaseModule {
  readonly _configuration: PermitGenerationConfiguration | null = this.context.config.incentives.permitGeneration;
  readonly _autoTransferMode: boolean = this.context.config.automaticTransferMode;
  readonly _evmPrivateEncrypted: string = this.context.config.evmPrivateEncrypted;
  readonly _evmNetworkId: number = this.context.config.evmNetworkId;
  readonly _erc20RewardToken: string = this.context.config.erc20RewardToken;
  readonly _supabase = createClient<Database>(this.context.env.SUPABASE_URL, this.context.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const networkExplorer = await this._getNetworkExplorer(this._evmNetworkId);
    const canMakePayment = await this._canMakePayment(data);
    if (!canMakePayment) {
      this.context.logger.error("[PaymentModule] Non collaborative issue detected, skipping.");
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

    // Decrypt the private key object
    const privateKeyParsed = await this._parsePrivateKey(this._evmPrivateEncrypted);
    if (!privateKeyParsed.privateKey) {
      this.context.logger.error("[PaymentModule] Private key is null.");
      return Promise.resolve(result);
    }
    const isPrivateKeyAllowed = await this._isPrivateKeyAllowed(
      privateKeyParsed,
      this.context.payload.repository.owner.id,
      this.context.payload.repository.id
    );
    if (!isPrivateKeyAllowed) {
      this.context.logger.error(
        "[PaymentModule] Private key is not allowed to be used in this organization/repository."
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

    if (this._autoTransferMode) {
      // Generate the batch transfer nonce
      const nonce = utils.keccak256(utils.toUtf8Bytes(issueId.toString()));
      // Check if funding wallet has enough reward token and gas to transfer rewards directly
      const [canTransferDirectly, permit2Wrapper, fundingWallet, beneficiaries] = await this._canTransferDirectly(
        privateKeyParsed.privateKey,
        result,
        nonce
      );
      if (canTransferDirectly) {
        this.context.logger.info(
          "[PaymentModule] AutoTransformMode is enabled, and the funding wallet has sufficient funds available."
        );
        try {
          const tx = await this._transferReward(
            permit2Wrapper,
            fundingWallet,
            beneficiaries.addresses,
            beneficiaries.amounts,
            nonce
          );
          beneficiaries.usernames.forEach((username) => {
            result[username].explorerUrl = `${networkExplorer}/tx/${tx.hash}`;
          });
        } catch (e) {
          this.context.logger.error(`[PaymentModule] Failed to transfer rewards through Disperse.app`, { e });
        }
        return result;
      }
      this.context.logger.info(
        "[PaymentModule] AutoTransformMode is enabled, but the funding wallet lacks sufficient funds. Skipping."
      );
    }

    for (const [username, reward] of Object.entries(result)) {
      this.context.logger.debug(`Updating result for user ${username}`);
      const config: Context["config"] = {
        evmNetworkId: payload.evmNetworkId,
        evmPrivateEncrypted: payload.evmPrivateEncrypted,
        permitRequests: [
          {
            amount: reward.total,
            username: username,
            contributionType: "",
            type: TokenType.ERC20,
            tokenAddress: payload.erc20RewardToken,
          },
        ],
      };
      try {
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
        result[username].permitUrl = `https://pay.ubq.fi?claim=${encodePermits(permits)}`;
        await this._savePermitsToDatabase(result[username].userId, { issueUrl: payload.issueUrl, issueId }, permits);
        // remove treasury item from final result in order not to display permit fee in GitHub comments
        if (env.PERMIT_TREASURY_GITHUB_USERNAME) delete result[env.PERMIT_TREASURY_GITHUB_USERNAME];
      } catch (e) {
        this.context.logger.error(`[PaymentModule] Failed to generate permits for user ${username}`, { e });
      }
    }
    return result;
  }

  async _getNetworkExplorer(networkId: number): Promise<string> {
    const networkExplorer = getNetworkExplorer(String(networkId) as NetworkId);
    if (!networkExplorer || networkExplorer.length === 0) {
      return "https://blockscan.com";
    }
    return networkExplorer[0].url;
  }

  async _canMakePayment(data: Readonly<IssueActivity>) {
    if (!data.self?.closed_by || !data.self.user) return false;

    if (await isAdmin(data.self.user.login, this.context)) return true;

    return isCollaborative(data);
  }

  /*
   * This method checks that the funding wallet has enough reward tokens for a direct transfer and sufficient funds to cover gas fees.
   * @param private key of the funding wallet
   * @param result Result object
   * @returns [canTransferDirectly, erc20Wrapper, fundingWallet, beneficiaries]
   */
  async _canTransferDirectly(
    privateKey: string,
    result: Result,
    nonce: string
  ): Promise<[true, Permit2Wrapper, ethers.Wallet, Beneficiaries] | [false, null, null, null]> {
    try {
      const erc20Contract = await getContract(this._evmNetworkId, this._erc20RewardToken);
      const fundingWallet = await getEvmWallet(privateKey, erc20Contract.provider);
      const erc20Wrapper = new Erc20Wrapper(erc20Contract);
      const decimals = await erc20Wrapper.getDecimals();
      // Fetch and normalize the funding wallet's reward token balance
      const fundingWalletRewardTokenBalance: BigNumber = await erc20Wrapper.getBalance(fundingWallet.address);

      // Fetch the funding wallet's native token balance
      const fundingWalletNativeTokenBalance = await fundingWallet.getBalance();

      const beneficiaries = await this._getBeneficiaries(result, decimals);
      if (beneficiaries === null) {
        return [false, null, null, null];
      }

      const permit2Contract = await getContract(this._evmNetworkId, permit2Address(this._evmNetworkId), PERMIT2_ABI);
      const permit2Wrapper = new Permit2Wrapper(permit2Contract);

      let batchTransferPermit: BatchTransferPermit;
      try {
        batchTransferPermit = await permit2Wrapper.generateBatchTransferPermit(
          fundingWallet,
          this._erc20RewardToken,
          beneficiaries.addresses,
          beneficiaries.amounts,
          BigNumber.from(nonce)
        );
      } catch (e) {
        throw new Error(this.context.logger.error("Failed to generate batch transfer permit", { e }).logMessage.raw);
      }

      const totalFee = await permit2Wrapper.estimatePermitTransferFromGas(fundingWallet, batchTransferPermit);
      const totalReward = beneficiaries.amounts.reduce(
        (accumulator, current) => accumulator.add(current),
        BigNumber.from(0)
      );

      const hasEnoughGas = fundingWalletNativeTokenBalance.gt(totalFee);
      const hasEnoughRewardToken = fundingWalletRewardTokenBalance.gt(totalReward);
      const gasAndRewardInfo = {
        gas: {
          has: fundingWalletNativeTokenBalance.toString(),
          required: totalFee.toString(),
        },
        rewardToken: {
          has: fundingWalletRewardTokenBalance.toString(),
          required: totalReward.toString(),
        },
      };
      if (!hasEnoughGas || !hasEnoughRewardToken) {
        this.context.logger.error(
          `[PaymentModule] The funding wallet lacks sufficient gas and/or reward tokens to perform direct transfers`,
          gasAndRewardInfo
        );
        return [false, null, null, null];
      }
      this.context.logger.info(
        `[PaymentModule] The funding wallet has sufficient gas and reward tokens to perform direct transfers`,
        gasAndRewardInfo
      );
      return [true, permit2Wrapper, fundingWallet, beneficiaries];
    } catch (e) {
      this.context.logger.error(`[PaymentModule] Failed to fetch the funding wallet data: ${e}`, { e });
      return [false, null, null, null];
    }
  }

  async _getBeneficiaries(result: Result, decimals: number): Promise<Beneficiaries | null> {
    const beneficiaries: Beneficiaries = { usernames: [], addresses: [], amounts: [] };
    for (const [username, reward] of Object.entries(result)) {
      // Obtain the beneficiary wallet address from the github user name
      const { data: userData } = await this.context.octokit.rest.users.getByUsername({ username });
      if (!userData) {
        this.context.logger.error(`GitHub user was not found for id ${username}`);
        return null;
      }
      const userId = userData.id;
      const { data: walletData } = await this._supabase.from("wallets").select("address").eq("id", userId).single();
      if (!walletData?.address) {
        this.context.logger.error("Beneficiary wallet not found");
        return null;
      }
      beneficiaries.usernames.push(username);
      beneficiaries.addresses.push(walletData.address);
      beneficiaries.amounts.push(ethers.utils.parseUnits(reward.total.toString(), decimals));
    }
    return beneficiaries;
  }

  async _transferReward(
    permit2Wrapper: Permit2Wrapper,
    fundingWallet: ethers.Wallet,
    beneficiaryWalletAddresses: string[],
    beneficiaryRewardAmounts: BigNumber[],
    nonce: string,
    maxRetries = 5,
    initialDelayMs = 500
  ): Promise<ethers.providers.TransactionResponse> {
    let attempt = 0;
    let delay = initialDelayMs;
    let batchTransferPermit: BatchTransferPermit;
    try {
      batchTransferPermit = await permit2Wrapper.generateBatchTransferPermit(
        fundingWallet,
        this._erc20RewardToken,
        beneficiaryWalletAddresses,
        beneficiaryRewardAmounts,
        BigNumber.from(nonce)
      );
    } catch (e) {
      throw new Error(this.context.logger.error("Failed to generate batch transfer permit", { e }).logMessage.raw);
    }

    // Executing permitTransferFrom immediately to process the reward transfers.
    while (attempt < maxRetries) {
      try {
        this.context.logger.info(`Attempt ${attempt + 1}: Sending transaction...`);

        // Perform the Permit2 batch transfer transaction.
        const tx = await permit2Wrapper.sendPermitTransferFrom(fundingWallet, batchTransferPermit);
        this.context.logger.info(`Executed permitTransferFrom contract call, transaction hash: ${tx.hash}`);

        // Wait for the transaction to be confirmed
        const receipt = await tx.wait();
        this.context.logger.info(`Transaction confirmed in block: ${receipt.blockNumber}`);
        return tx;
      } catch (e) {
        if (typeof e === "object" && e !== null) {
          if ("code" in e && e.code === ethers.errors.INSUFFICIENT_FUNDS) {
            throw new Error(
              this.context.logger.error(`Error: Insufficient funds to complete the transaction`, { e }).logMessage.raw
            );
          } else if ("message" in e && typeof e.message === "string" && e.message.includes("INSUFFICIENT_FUNDS")) {
            throw new Error(this.context.logger.error("Error: Insufficient gas or balance detected").logMessage.raw);
          }
        }
        attempt++;
        this.context.logger.error(`Attempt ${attempt} failed: ${e}`, { e });
        // Exponential backoff delay
        this.context.logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    throw new Error(this.context.logger.error(`Transaction failed after ${maxRetries}`).logMessage.raw);
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

  async _parsePrivateKey(evmPrivateEncrypted: string) {
    const privateKeyDecrypted = await decrypt(evmPrivateEncrypted, String(process.env.X25519_PRIVATE_KEY));
    return parseDecryptedPrivateKey(privateKeyDecrypted);
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
    privateKeyParsed: {
      privateKey: string | null;
      allowedOrganizationId: number | null;
      allowedRepositoryId: number | null;
    },
    githubContextOwnerId: number,
    githubContextRepositoryId: number
  ): Promise<boolean> {
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
      this.context.logger.error("Invalid / missing configuration detected for PaymentModule, disabling.");
      return false;
    }
    return true;
  }
}
