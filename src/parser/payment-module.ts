import { context } from "@actions/github";
import { RestEndpointMethodTypes } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { createClient, PostgrestError } from "@supabase/supabase-js";
import { decodeError } from "@ubiquity-os/ethers-decode-error";
import {
  Context,
  createAdapters,
  decrypt,
  encodePermits,
  generatePayoutPermit,
  parseDecryptedPrivateKey,
  PermitReward,
  SupportedEvents,
  TokenType,
} from "@ubiquity-os/permit-generation";
import { MaxUint256 } from "@uniswap/permit2-sdk";
import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import { BigNumber, ethers, utils } from "ethers";
import { PaymentConfiguration, paymentConfigurationType } from "../configuration/payment-configuration";
import { isAdmin, isCollaborative } from "../helpers/checkers";
import { getUserRewardRole } from "../helpers/permissions";
import { isGlobalRewardSettings, resolveRewardSettingsForRole, rewardConfigKey } from "../helpers/reward-settings";
import {
  BatchTransferPermit,
  ERC20_ABI,
  Erc20Wrapper,
  getContract,
  getEvmWallet,
  PERMIT2_ABI,
  Permit2Wrapper,
  TransferRequest,
} from "../helpers/web3";
import { IssueActivity } from "../issue-activity";
import { parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { PERMIT2_ADDRESS } from "../types/permit2";
import { RewardSettings } from "../types/plugin-input";
import { PayoutMode, PermitSaveError, Result } from "../types/results";
import chains from "../types/rpcs.json";
import type { Database } from "../adapters/supabase/types/database";

interface Payload {
  evmNetworkId: number;
  issueUrl: string;
  evmPrivateEncrypted: string;
  erc20RewardToken: string;
  issue: { node_id: string };
}

export interface Beneficiary {
  username: string;
  address: string;
  amount: number;
}

export interface DirectTransferInfo {
  fundingWallet: ethers.Wallet;
  beneficiaries: Beneficiary[];
  permit2Wrapper: Permit2Wrapper;
  batchTransferPermit: BatchTransferPermit;
  nonce: string;
  rewardTokenAddress: string;
  networkId: number;
}

type PermitMetadata = {
  networkId: number;
  permit2Address: string;
  partnerId: number;
};

type ResultEntry = Result[string];

type ExistingPermitRecord = {
  id: number;
  amount: string;
  transaction: string | null;
};

type RpcFallbackReason = "permission denied" | "unavailable";

export class PaymentModule extends BaseModule {
  readonly _configuration: PaymentConfiguration | null = this.context.config.incentives.payment;
  readonly _autoTransferMode =
    this.context.config.incentives.payment?.automaticTransferMode == undefined
      ? true
      : this.context.config.incentives.payment?.automaticTransferMode;
  readonly _supabase = createClient<Database>(this.context.env.SUPABASE_URL, this.context.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const canMakePayment = await this._canMakePayment(data);
    if (!canMakePayment) {
      this.context.logger.warn("Non collaborative issue detected, skipping.");
      return Promise.resolve(result);
    }

    const { xpUsernames, tokenGroups } = await this._splitUsersByRewardConfiguration(result);

    if (xpUsernames.length > 0) {
      const xpResult = this._selectResultSubset(result, xpUsernames);
      await this._handleXpRecording(xpResult);
      this._removeTreasuryItem(result);
    }

    if (!tokenGroups.length) {
      if (!this.context.config.rewards) {
        this.context.logger.info("No permit settings found, switching to XP recording mode.");
      } else {
        this.context.logger.info("No reward settings matched the eligible users, switching to XP recording mode.");
      }
      return result;
    }

    const payoutMode = await this._getPayoutMode(data);
    if (payoutMode === null) {
      throw this.context.logger.warn("Rewards can not be transferred twice.");
    }

    for (const group of tokenGroups) {
      const groupResult = this._selectResultSubset(result, group.usernames);
      await this._processTokenRewardGroup(data, groupResult, group.config, payoutMode);
      this._removeTreasuryItem(result);
    }

    return result;
  }

  private _selectResultSubset(result: Result, usernames: string[]): Result {
    const subset: Result = {};
    for (const username of usernames) {
      if (username === this.context.env.PERMIT_TREASURY_GITHUB_USERNAME) {
        continue;
      }
      if (result[username]) {
        subset[username] = result[username];
      }
    }
    return subset;
  }

  private async _splitUsersByRewardConfiguration(result: Result) {
    const usernames = Object.keys(result).filter(
      (username) => username !== this.context.env.PERMIT_TREASURY_GITHUB_USERNAME
    );
    const xpUsernames: string[] = [];
    const tokenGroupMap = new Map<string, { config: RewardSettings; usernames: string[] }>();
    const rewardsConfig = this.context.config.rewards;

    if (!rewardsConfig) {
      xpUsernames.push(...usernames);
      return { xpUsernames, tokenGroups: [] as { config: RewardSettings; usernames: string[] }[] };
    }

    if (isGlobalRewardSettings(rewardsConfig)) {
      return {
        xpUsernames,
        tokenGroups: [
          {
            config: rewardsConfig,
            usernames,
          },
        ],
      };
    }

    for (const username of usernames) {
      const reward = result[username];
      if (!reward) {
        continue;
      }
      const role = await getUserRewardRole(this.context, username);
      const config = resolveRewardSettingsForRole(rewardsConfig, role);
      if (!config) {
        xpUsernames.push(username);
        continue;
      }
      const key = rewardConfigKey(config);
      const existing = tokenGroupMap.get(key);
      if (existing) {
        existing.usernames.push(username);
      } else {
        tokenGroupMap.set(key, { config, usernames: [username] });
      }
    }

    return { xpUsernames, tokenGroups: Array.from(tokenGroupMap.values()) };
  }

  private _createPermitLogger() {
    return {
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
  }

  private async _processTokenRewardGroup(
    data: Readonly<IssueActivity>,
    result: Result,
    config: RewardSettings,
    payoutMode: PayoutMode
  ) {
    const issue = "issue" in this.context.payload ? this.context.payload.issue : this.context.payload.pull_request;
    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: issue.html_url,
      evmPrivateEncrypted: config.evmPrivateEncrypted,
      evmNetworkId: config.evmNetworkId,
      erc20RewardToken: config.erc20RewardToken,
    };
    const issueId = Number(RegExp(/\d+$/).exec(payload.issueUrl)?.[0]);
    payload.issue = {
      node_id: issue.node_id,
    };

    const privateKeyParsed = await this._parsePrivateKey(config.evmPrivateEncrypted);
    const [isPrivateKeyAllowed, privateKey] = await this._isPrivateKeyAllowed(
      privateKeyParsed,
      this.context.payload.repository.owner.id,
      this.context.payload.repository.id
    );
    if (!isPrivateKeyAllowed) {
      this.context.logger.error("Private key is not allowed to be used in this organization/repository.");
      return;
    }

    this.context.logger.info("Will attempt to apply fees...");
    await this._applyFees(result, config.erc20RewardToken);

    await this._addWalletAddressesToResult(result);

    const env = this.context.env;
    const eventName = context.eventName as SupportedEvents;
    const octokit = this.context.octokit as unknown as Context["octokit"];
    const permitLogger = this._createPermitLogger();
    const adapters = {} as ReturnType<typeof createAdapters>;
    const networkExplorer = this._getNetworkExplorer(config.evmNetworkId);

    let directTransferError;
    if (payoutMode === "transfer") {
      try {
        await this._tryDirectTransfer(result, config, networkExplorer, issueId, payload.issueUrl, privateKey);
      } catch (e) {
        this.context.logger.warn(`Failed to auto transfer rewards via batch permit transfer`, { e });
        directTransferError = e;
      }
    }

    if (payoutMode === "permit" || directTransferError) {
      this.context.logger.info("Transitioning to permit generation.");
      for (const [username, reward] of Object.entries(result)) {
        this.context.logger.debug(`Updating result for user ${username}`);
        const configPayload: Context["config"] = {
          evmNetworkId: payload.evmNetworkId,
          evmPrivateEncrypted: payload.evmPrivateEncrypted,
          permitRequests: [
            {
              amount: reward.total,
              username,
              contributionType: "reward",
              type: TokenType.ERC20,
              tokenAddress: payload.erc20RewardToken,
            },
          ],
        };
        let permits: PermitReward[];
        try {
          permits = await generatePayoutPermit(
            {
              env,
              eventName,
              logger: permitLogger,
              payload,
              adapters: createAdapters(this._supabase, {
                env,
                eventName,
                octokit,
                config: configPayload,
                logger: permitLogger,
                payload,
                adapters,
              }),
              octokit,
              config: configPayload,
            },
            configPayload.permitRequests
          );
        } catch (e) {
          this.context.logger.warn(`Failed to generate permits for user ${username}`, { e });
          continue;
        }

        result[username].permitUrl = `https://pay.ubq.fi?claim=${encodePermits(permits)}`;
        result[username].payoutMode = "permit";
        await this._savePermitsToDatabase(result[username], { issueUrl: payload.issueUrl, issueId }, permits);
      }
    }

    this._removeTreasuryItem(result);
  }

  private async _tryDirectTransfer(
    result: Result,
    config: RewardSettings,
    networkExplorer: string,
    issueId: number,
    issueUrl: string,
    privateKey: string
  ): Promise<void> {
    const beneficiaries = await this._getBeneficiaries(result);
    if (beneficiaries.length === 0) {
      throw this.context.logger.warn("Beneficiary list is empty, skipping the direct transfer of rewards...");
    }

    const nonce = utils.keccak256(utils.toUtf8Bytes(issueId.toString()));
    const directTransferInfo = await this._getDirectTransferInfo(beneficiaries, config, privateKey, nonce);
    this.context.logger.info("Funding wallet has sufficient funds to directly transfer the rewards.");
    const [tx, permits] = await this._transferReward(directTransferInfo);
    this.context.logger.info("Rewards have been transferred.");
    await Promise.all(
      beneficiaries.map(async (beneficiary, idx) => {
        result[beneficiary.username].explorerUrl = `${networkExplorer}/tx/${tx.hash}`;
        result[beneficiary.username].payoutMode = "transfer";
        await this._savePermitsToDatabase(result[beneficiary.username], { issueUrl, issueId }, [permits[idx]]);
      })
    );
  }

  private _removeTreasuryItem(result: Result) {
    if (this.context.env.PERMIT_TREASURY_GITHUB_USERNAME) {
      delete result[this.context.env.PERMIT_TREASURY_GITHUB_USERNAME];
    }
  }

  /* This method returns the transfer mode based on the following conditions:
   - null: Indicates that the payout was previously transferred directly, meaning no further payout is required.
   - Permit: Applies if autoTransferMode is set to false or if rewards were previously generated using the permit method.
   - Transfer: Applies if autoTransferMode is set to true and no previous payout method has been used for the rewards.
  */
  async _getPayoutMode(data: Readonly<IssueActivity>): Promise<PayoutMode | null> {
    for (const comment of data.comments) {
      if (comment.body && comment.user?.type === "Bot") {
        if (/"payoutMode":\s*"transfer"/.exec(comment.body)) return null;
        else if (/"payoutMode":\s*"permit"/.exec(comment.body)) return "permit";
      }
    }
    return this._autoTransferMode ? "transfer" : "permit";
  }

  _getNetworkExplorer(networkId: number): string {
    const chain = chains.find((chain) => chain.chainId === networkId);
    return chain?.explorers?.[0].url || "https://blockscan.com";
  }

  async _canMakePayment(data: Readonly<IssueActivity>) {
    if (!data.self?.closed_by || !data.self.user) return false;

    if (await isAdmin(data.self.user.login, this.context)) return true;

    return isCollaborative(data);
  }

  // This method checks that the funding wallet has enough reward tokens for a direct transfer and sufficient funds to cover gas fees.
  async _getDirectTransferInfo(
    beneficiaries: Beneficiary[],
    config: RewardSettings,
    privateKey: string,
    nonce: string
  ): Promise<DirectTransferInfo> {
    const { rewardTokenWrapper, fundingWallet } = await this._initializeContractsAndWallet(config, privateKey);
    const { rewardBalance, rewardAllowance, nativeBalance } = await this._fetchBalancesAndAllowances(
      rewardTokenWrapper,
      fundingWallet
    );
    // Calculate the total reward and check if there are enough reward tokens
    const rewardTokenDecimals = await rewardTokenWrapper.getDecimals();
    const transferRequests: TransferRequest[] = beneficiaries.map(
      (beneficiary) =>
        ({
          address: beneficiary.address,
          amount: ethers.utils.parseUnits(beneficiary.amount.toString(), rewardTokenDecimals),
        }) as TransferRequest
    );
    const totalReward = transferRequests.reduce(
      (accumulator, current) => accumulator.add(current.amount),
      BigNumber.from(0)
    );
    const hasEnoughRewardToken = rewardBalance.gt(totalReward) && rewardAllowance.gt(totalReward);
    const directTransferLog = {
      gas: {
        has: nativeBalance.toString(),
        required: "Unavailable",
      },
      rewardToken: {
        has: rewardBalance.toString(),
        allowed: rewardAllowance.toString(),
        required: totalReward.toString(),
      },
    };
    if (!hasEnoughRewardToken) {
      throw this.context.logger.warn(
        `The funding wallet lacks sufficient reward tokens to perform direct transfers`,
        directTransferLog
      );
    }
    const permit2Contract = await getContract(config.evmNetworkId, PERMIT2_ADDRESS, PERMIT2_ABI);
    const permit2Wrapper = new Permit2Wrapper(permit2Contract);
    const { gasEstimation, batchTransferPermit } = await this._getGasEstimation(
      fundingWallet,
      permit2Wrapper,
      transferRequests,
      nonce,
      config
    );
    directTransferLog.gas.required = gasEstimation.toString();
    if (nativeBalance.lte(gasEstimation.mul(2))) {
      throw this.context.logger.warn(
        `The funding wallet lacks sufficient gas to perform direct transfers`,
        directTransferLog
      );
    }
    this.context.logger.info(
      `The funding wallet has sufficient gas and reward tokens to perform direct transfers`,
      directTransferLog
    );
    return {
      fundingWallet,
      beneficiaries,
      permit2Wrapper,
      batchTransferPermit,
      nonce,
      rewardTokenAddress: config.erc20RewardToken,
      networkId: config.evmNetworkId,
    };
  }

  private async _initializeContractsAndWallet(config: RewardSettings, privateKey: string) {
    const erc20Contract = await getContract(config.evmNetworkId, config.erc20RewardToken, ERC20_ABI);
    const fundingWallet = await getEvmWallet(privateKey, erc20Contract.provider);
    const rewardTokenWrapper = new Erc20Wrapper(erc20Contract);
    return { rewardTokenWrapper, fundingWallet };
  }

  private async _fetchBalancesAndAllowances(rewardTokenWrapper: Erc20Wrapper, fundingWallet: ethers.Wallet) {
    const rewardBalance = await rewardTokenWrapper.getBalance(fundingWallet.address);
    const rewardAllowance = await rewardTokenWrapper.getAllowance(fundingWallet.address, PERMIT2_ADDRESS);
    const nativeBalance = await fundingWallet.getBalance();
    return { rewardBalance, rewardAllowance, nativeBalance };
  }

  private async _getGasEstimation(
    fundingWallet: ethers.Wallet,
    permit2Wrapper: Permit2Wrapper,
    transferRequests: TransferRequest[],
    nonce: string,
    config: RewardSettings
  ): Promise<{ gasEstimation: BigNumber; batchTransferPermit: BatchTransferPermit }> {
    try {
      const batchTransferPermit = await permit2Wrapper.generateBatchTransferPermit(
        fundingWallet,
        config.erc20RewardToken,
        transferRequests,
        BigNumber.from(nonce)
      );
      const gasEstimation = await permit2Wrapper.estimatePermitTransferFromGas(fundingWallet, batchTransferPermit);
      return { gasEstimation, batchTransferPermit };
    } catch (e) {
      const { error } = decodeError(e);
      throw this.context.logger.warn("Gas estimation failed for direct transfer transaction", { err: error });
    }
  }

  async _getBeneficiaries(result: Result): Promise<Beneficiary[]> {
    return Object.entries(result)
      .map(([username, reward]) => {
        if (!reward.walletAddress) {
          return null;
        }
        return {
          username,
          address: reward.walletAddress,
          amount: reward.total,
        };
      })
      .filter((beneficiary) => beneficiary !== null);
  }

  async _transferReward({
    fundingWallet,
    beneficiaries,
    permit2Wrapper,
    batchTransferPermit,
    nonce,
    rewardTokenAddress,
    networkId,
  }: DirectTransferInfo): Promise<[ethers.providers.TransactionResponse, PermitReward[]]> {
    try {
      const tx = await permit2Wrapper.sendPermitTransferFrom(fundingWallet, batchTransferPermit);
      this.context.logger.info(`Executed permitTransferFrom contract call, transaction hash: ${tx.hash}`);

      const receipt = await tx.wait();
      this.context.logger.info(`Transaction confirmed in block: ${receipt.blockNumber}`);
      const permits = beneficiaries.map(
        (beneficiary) =>
          ({
            tokenType: TokenType.ERC20,
            tokenAddress: rewardTokenAddress,
            beneficiary: beneficiary.address,
            nonce: nonce,
            deadline: MaxUint256,
            owner: fundingWallet.address,
            signature: batchTransferPermit.signature,
            networkId,
            amount: beneficiary.amount,
          }) as PermitReward
      );
      return [tx, permits];
    } catch (e) {
      const error = decodeError(e);
      throw this.context.logger.warn(`Direct reward transfer failed due to an EVM transaction error`, { err: error });
    }
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

  async _addWalletAddressesToResult(result: Result) {
    for (const reward of Object.values(result)) {
      reward.walletAddress = await this.context.adapters.supabase.wallet
        .getWalletByUserId(reward.userId)
        .catch(() => undefined);
    }
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
        this.context.logger.error("Failed to insert a new token:", { err: error });
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
        this.context.logger.error("Failed to insert a new token:", { err: error });
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

  async _savePermitsToDatabase(
    rewardResult: ResultEntry,
    issue: { issueId: number; issueUrl: string },
    permits: PermitReward[]
  ) {
    // Normalize here so fallback inserts (when RPC is unavailable) stay lowercased.
    const permit2Address = PERMIT2_ADDRESS.toLowerCase();
    const errors: PermitSaveError[] = [];
    const userId = rewardResult.userId;

    for (const permit of permits) {
      const amount = new Decimal(permit.amount.toString());
      if (!amount.gt(0)) {
        this.context.logger.warn("Skipping permit persistence because amount is zero.", {
          beneficiaryId: userId,
          issueId: issue.issueId,
          nonce: permit.nonce,
        });
        continue;
      }
      try {
        const { data: userData } = await this._supabase.from("users").select("id").eq("id", userId).single();
        const locationId = await this.context.adapters.supabase.location.getOrCreateIssueLocation(issue);
        const tokenId = await this._getOrCreateToken(permit.tokenAddress, permit.networkId);
        const partnerId = await this._getOrCreatePartner(permit.owner);

        if (userData) {
          const insertData: Database["public"]["Tables"]["permits"]["Insert"] = {
            amount: String(permit.amount),
            nonce: String(permit.nonce),
            deadline: String(permit.deadline),
            signature: permit.signature,
            beneficiary_id: userData.id,
            location_id: locationId,
            token_id: tokenId,
            partner_id: partnerId,
            network_id: permit.networkId,
            permit2_address: permit2Address,
          };
          const missingMetadata = this._getMissingPermitMetadata(insertData);
          if (missingMetadata.length > 0) {
            errors.push({
              message: `Permit missing required metadata for upsert: ${missingMetadata.join(", ")}`,
              nonce: insertData.nonce,
              amount: insertData.amount,
              signature: insertData.signature,
              partnerId,
              beneficiaryId: userData.id,
            });
            continue;
          }
          const didUpsert = await this._upsertPermitRecord(insertData);
          if (!didUpsert) {
            errors.push({
              message: "Failed to save permit via upsert_permit_max.",
              nonce: insertData.nonce,
              amount: insertData.amount,
              signature: insertData.signature,
              partnerId,
              beneficiaryId: userData.id,
            });
          }
        } else {
          errors.push({
            message: `Failed to save permit: could not find user ${userId}.`,
            nonce: String(permit.nonce),
            amount: String(permit.amount),
            beneficiaryId: userId,
          });
        }
      } catch (e) {
        errors.push({
          message: `Failed to save permit: ${e instanceof Error ? e.message : "unknown error"}.`,
          nonce: String(permit.nonce),
          amount: String(permit.amount),
          beneficiaryId: userId,
        });
      }
    }

    if (errors.length > 0) {
      rewardResult.permitSaveErrors = [...(rewardResult.permitSaveErrors ?? []), ...errors];
    }
  }

  /**
   * Upsert a permit via RPC, falling back to insert + dedupe when RPC is unavailable.
   * Uses optimistic guards to avoid overwriting claimed or higher-amount rows.
   */
  private async _upsertPermitRecord(insertData: Database["public"]["Tables"]["permits"]["Insert"]): Promise<boolean> {
    const metadata = this._resolvePermitMetadata(insertData);
    if (!metadata) {
      return false;
    }

    const { error } = await this._supabase.rpc("upsert_permit_max", {
      p_amount: insertData.amount,
      p_nonce: insertData.nonce,
      p_deadline: insertData.deadline,
      p_signature: insertData.signature,
      p_beneficiary_id: insertData.beneficiary_id,
      p_location_id: insertData.location_id ?? null,
      p_token_id: insertData.token_id ?? null,
      p_partner_id: metadata.partnerId,
      p_network_id: metadata.networkId,
      p_permit2_address: metadata.permit2Address,
    });

    if (!error) {
      return true;
    }

    const fallbackReason = this._getRpcFallbackReason(error);

    if (!fallbackReason) {
      return false;
    }

    return this._insertPermitWithFallback(insertData, metadata);
  }

  private _resolvePermitMetadata(insertData: Database["public"]["Tables"]["permits"]["Insert"]): PermitMetadata | null {
    const missingFields = this._getMissingPermitMetadata(insertData);
    if (missingFields.length > 0) {
      return null;
    }
    const { network_id: networkId, permit2_address: permit2Address, partner_id: partnerId } = insertData;
    return {
      networkId: networkId as number,
      permit2Address: permit2Address as string,
      partnerId: partnerId as number,
    };
  }

  private _getMissingPermitMetadata(insertData: Database["public"]["Tables"]["permits"]["Insert"]): string[] {
    const missingFields: string[] = [];
    if (insertData.network_id === null || insertData.network_id === undefined) {
      missingFields.push("network_id");
    }
    if (insertData.permit2_address === null || insertData.permit2_address === undefined) {
      missingFields.push("permit2_address");
    }
    if (insertData.partner_id === null || insertData.partner_id === undefined) {
      missingFields.push("partner_id");
    }
    return missingFields;
  }

  private _getRpcFallbackReason(error: PostgrestError): RpcFallbackReason | null {
    const normalizedMessage = error.message.toLowerCase();
    const code = error.code;
    const isSchemaCacheMissing =
      normalizedMessage.includes("schema cache") && normalizedMessage.includes("upsert_permit_max");
    const isRpcMissing =
      code === "42883" ||
      code === "PGRST202" ||
      normalizedMessage.includes("upsert_permit_max does not exist") ||
      isSchemaCacheMissing;
    const isRpcPermissionDenied = code === "42501" || normalizedMessage.includes("permission denied");
    if (isRpcPermissionDenied) {
      return "permission denied";
    }
    if (isRpcMissing) {
      return "unavailable";
    }
    return null;
  }

  private async _insertPermitWithFallback(
    insertData: Database["public"]["Tables"]["permits"]["Insert"],
    metadata: PermitMetadata
  ): Promise<boolean> {
    const { error: insertError } = await this._supabase.from("permits").insert(insertData);
    if (!insertError) {
      return true;
    }

    if (!this._isUniqueViolation(insertError)) {
      return false;
    }

    return this._handleDuplicatePermitAfterFallback(insertData, metadata);
  }

  private _isUniqueViolation(error: PostgrestError): boolean {
    const { message, code } = error;
    const normalizedMessage = message.toLowerCase();
    return code === "23505" || normalizedMessage.includes("duplicate key value violates unique constraint");
  }

  private async _handleDuplicatePermitAfterFallback(
    insertData: Database["public"]["Tables"]["permits"]["Insert"],
    metadata: PermitMetadata
  ): Promise<boolean> {
    const existingPermit = await this._loadExistingPermit(metadata, insertData);
    if (!existingPermit) {
      return false;
    }
    if (existingPermit.transaction) {
      this.context.logger.info("Permit already claimed; keeping existing record after RPC fallback", {
        id: existingPermit.id,
        nonce: insertData.nonce,
        beneficiary_id: insertData.beneficiary_id,
      });
      return true;
    }

    const incomingAmount = this._parsePermitAmount(insertData.amount);
    if (!incomingAmount) {
      return false;
    }

    return this._tryUpdateExistingPermitAfterFallback(insertData, existingPermit, incomingAmount, metadata);
  }

  private async _loadExistingPermit(
    metadata: PermitMetadata,
    insertData: Database["public"]["Tables"]["permits"]["Insert"]
  ): Promise<ExistingPermitRecord | null> {
    const { data: existingPermit, error: existingError } = await this._supabase
      .from("permits")
      .select("id, amount, transaction")
      .eq("partner_id", metadata.partnerId)
      .eq("network_id", metadata.networkId)
      .eq("permit2_address", metadata.permit2Address)
      .eq("nonce", insertData.nonce)
      .maybeSingle();
    return existingError || !existingPermit ? null : existingPermit;
  }

  private _parsePermitAmount(amount: string): Decimal | null {
    try {
      return new Decimal(amount);
    } catch {
      return null;
    }
  }

  private async _tryUpdateExistingPermitAfterFallback(
    insertData: Database["public"]["Tables"]["permits"]["Insert"],
    existingPermit: ExistingPermitRecord,
    incomingAmount: Decimal,
    metadata: PermitMetadata
  ): Promise<boolean> {
    const currentAmount = this._parsePermitAmount(existingPermit.amount);
    if (!currentAmount) {
      return false;
    }
    if (incomingAmount.lte(currentAmount)) {
      this.context.logger.info("Existing permit amount is higher or equal; keeping existing record", {
        id: existingPermit.id,
        nonce: insertData.nonce,
        beneficiary_id: insertData.beneficiary_id,
      });
      return true;
    }

    const updateResult = await this._attemptPermitUpdate(existingPermit, insertData);
    if (updateResult === "error") {
      return false;
    }
    if (updateResult === "updated") {
      this.context.logger.info("Updated existing permit after RPC fallback", {
        id: existingPermit.id,
        nonce: insertData.nonce,
        beneficiary_id: insertData.beneficiary_id,
      });
      return true;
    }

    return this._handlePermitUpdateRace(insertData, incomingAmount, metadata);
  }

  private async _handlePermitUpdateRace(
    insertData: Database["public"]["Tables"]["permits"]["Insert"],
    incomingAmount: Decimal,
    metadata: PermitMetadata
  ): Promise<boolean> {
    const refreshedPermit = await this._loadExistingPermit(metadata, insertData);
    if (!refreshedPermit) {
      return false;
    }
    if (refreshedPermit.transaction) {
      this.context.logger.info("Permit already claimed; keeping existing record after RPC fallback", {
        id: refreshedPermit.id,
        nonce: insertData.nonce,
        beneficiary_id: insertData.beneficiary_id,
      });
      return true;
    }
    const refreshedAmount = this._parsePermitAmount(refreshedPermit.amount);
    if (!refreshedAmount) {
      return false;
    }
    if (incomingAmount.lte(refreshedAmount)) {
      this.context.logger.info("Existing permit amount is higher or equal; keeping existing record", {
        id: refreshedPermit.id,
        nonce: insertData.nonce,
        beneficiary_id: insertData.beneficiary_id,
      });
      return true;
    }

    const retryResult = await this._attemptPermitUpdate(refreshedPermit, insertData);
    if (retryResult === "error") {
      return false;
    }
    if (retryResult === "updated") {
      this.context.logger.info("Updated existing permit after RPC fallback", {
        id: refreshedPermit.id,
        nonce: insertData.nonce,
        beneficiary_id: insertData.beneficiary_id,
      });
      return true;
    }

    this.context.logger.info("Skipped updating permit after RPC fallback; permit changed concurrently", {
      id: refreshedPermit.id,
      nonce: insertData.nonce,
      beneficiary_id: insertData.beneficiary_id,
    });
    return true;
  }

  private async _attemptPermitUpdate(
    existingPermit: ExistingPermitRecord,
    insertData: Database["public"]["Tables"]["permits"]["Insert"]
  ): Promise<"updated" | "skipped" | "error"> {
    const { data: updatedPermits, error: updateError } = await this._supabase
      .from("permits")
      .update({
        amount: insertData.amount,
        deadline: insertData.deadline,
        signature: insertData.signature,
        beneficiary_id: insertData.beneficiary_id,
        location_id: insertData.location_id ?? null,
        token_id: insertData.token_id ?? null,
        updated: new Date().toISOString(),
      })
      .eq("id", existingPermit.id)
      .eq("amount", existingPermit.amount)
      .is("transaction", null)
      .select("id");
    if (updateError) {
      return "error";
    }
    if (updatedPermits && updatedPermits.length > 0) {
      return "updated";
    }
    return "skipped";
  }

  async _parsePrivateKey(evmPrivateEncrypted: string) {
    const privateKeyDecrypted = await decrypt(evmPrivateEncrypted, String(process.env.X25519_PRIVATE_KEY));
    return parseDecryptedPrivateKey(privateKeyDecrypted);
  }

  private async _saveXpRecord(userId: number, issue: { issueId: number; issueUrl: string }, numericAmount: number) {
    this.context.logger.info(
      `Attempting to save XP for userId: ${userId}, issueId: ${issue.issueId}, amount: ${numericAmount}`
    );
    const { data: userData, error: userError } = await this._supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    let beneficiaryId: number;
    if (userError || !userData) {
      this.context.logger.info(`User with ID ${userId} not found in database. Attempting to create new user.`);

      const { data: newUserData, error: createError } = await this._supabase
        .from("users")
        .insert({ id: userId })
        .select("id")
        .single();

      if (createError || !newUserData) {
        throw this.context.logger.error(`Failed to create user with ID ${userId} in database.`, { createError });
      }

      this.context.logger.info(`Successfully created user with ID ${userId} in database.`);
      beneficiaryId = newUserData.id;
    } else {
      beneficiaryId = userData.id;
    }
    const locationId = await this.context.adapters.supabase.location.getOrCreateIssueLocation(issue);
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
        deadline: "0",
        signature: randomUUID(),
        partner_id: null,
      };
      const { error: insertError } = await this._supabase.from("permits").insert(insertData);

      if (insertError) {
        throw this.context.logger.error("Failed to insert XP record into database", { insertError });
      }
      this.context.logger.ok(`XP record inserted successfully for userId: ${userId}, issueId: ${issue.issueId}`);
    }
  }

  async _handleXpRecording(result: Result): Promise<Result> {
    const issue = "issue" in this.context.payload ? this.context.payload.issue : this.context.payload.pull_request;
    const issueUrl = issue.html_url;
    const { issue_number: issueId } = parseGitHubUrl(issueUrl);
    if (!issueId) {
      this.context.logger.error("[PaymentModule] Could not extract issue ID from URL for XP recording.", {
        issueUrl,
      });
      return result;
    }
    const issueDetails = { issueUrl, issueId };

    for (const [key, value] of Object.entries(result)) {
      if (key === this.context.env.PERMIT_TREASURY_GITHUB_USERNAME) {
        this.context.logger.info(`Skipping XP recording for treasury user ${key}.`);
        continue;
      }
      if (!value.userId) {
        this.context.logger.error(`[PaymentModule] Missing userId for user ${key}, cannot record XP.`);
        continue;
      }

      try {
        await this._saveXpRecord(value.userId, issueDetails, value.total);
        this.context.logger.ok(`Successfully recorded XP for user ${key} (ID: ${value.userId})`);
      } catch (e) {
        this.context.logger.error(`[PaymentModule] Failed to record XP for user ${key}`, { e });
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
    privateKeyParsed: {
      privateKey: string | null;
      allowedOrganizationId: number | null;
      allowedRepositoryId: number | null;
    },
    githubContextOwnerId: number,
    githubContextRepositoryId: number
  ): Promise<[true, string] | [false, null]> {
    if (!privateKeyParsed.privateKey) {
      this.context.logger.error("Private key could not be decrypted");
      return [false, null];
    }
    // private key + owner id
    // Format: PRIVATE_KEY:GITHUB_OWNER_ID
    if (privateKeyParsed.allowedOrganizationId && !privateKeyParsed.allowedRepositoryId) {
      if (privateKeyParsed.allowedOrganizationId !== githubContextOwnerId) {
        this.context.logger.info(
          `Current organization/user id ${githubContextOwnerId} is not allowed to use this private key`
        );
        return [false, null];
      }
      return [true, privateKeyParsed.privateKey];
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
        return [false, null];
      }
      return [true, privateKeyParsed.privateKey];
    }

    this.context.logger.error("Invalid private key format");
    return [false, null];
  }

  get enabled(): boolean {
    if (!Value.Check(paymentConfigurationType, this._configuration)) {
      this.context.logger.warn("The configuration for the module PaymentModule is invalid or missing, disabling.", {
        cfg: this._configuration,
      });
      return false;
    }
    return true;
  }
}
