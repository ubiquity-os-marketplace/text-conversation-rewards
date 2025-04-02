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
import { PaymentConfiguration, paymentConfigurationType } from "../configuration/payment-configuration";
import { IssueActivity } from "../issue-activity";
import { getRepo, parseGitHubUrl } from "../start";
import { BaseModule } from "../types/module";
import { PayoutMode, Result } from "../types/results";
import { isAdmin, isCollaborative } from "../helpers/checkers";
import { getNetworkExplorer, NetworkId } from "@ubiquity-dao/rpc-handler";
import { decodeError } from "@ubiquity-os/ethers-decode-error";
import {
  Erc20Wrapper,
  getContract,
  getEvmWallet,
  Permit2Wrapper,
  BatchTransferPermit,
  PERMIT2_ABI,
  ERC20_ABI,
  TransferRequest,
} from "../helpers/web3";
import { BigNumber, ethers, utils } from "ethers";
import { MaxUint256, permit2Address } from "@uniswap/permit2-sdk";

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
}

export class PaymentModule extends BaseModule {
  readonly _configuration: PaymentConfiguration | null = this.context.config.incentives.payment;
  readonly _autoTransferMode: boolean | undefined = this.context.config.incentives.payment?.automaticTransferMode;
  readonly _evmPrivateEncrypted: string = this.context.config.evmPrivateEncrypted;
  readonly _evmNetworkId: number = this.context.config.evmNetworkId;
  readonly _erc20RewardToken: string = this.context.config.erc20RewardToken;
  readonly _supabase = createClient<Database>(this.context.env.SUPABASE_URL, this.context.env.SUPABASE_KEY);

  async transform(data: Readonly<IssueActivity>, result: Result): Promise<Result> {
    const networkExplorer = await this._getNetworkExplorer(this._evmNetworkId);
    const canMakePayment = await this._canMakePayment(data);
    if (!canMakePayment) {
      this.context.logger.error("Non collaborative issue detected, skipping.");
      return Promise.resolve(result);
    }

    const payload: Context["payload"] & Payload = {
      ...context.payload.inputs,
      issueUrl: this.context.payload.issue.html_url,
      evmPrivateEncrypted: this.context.config.evmPrivateEncrypted,
      evmNetworkId: this.context.config.evmNetworkId,
      erc20RewardToken: this.context.config.erc20RewardToken,
    };
    // const { issue_number: issueId } = parseGitHubUrl(payload.issueUrl);
    const issueId = Number(RegExp(/\d+$/).exec(payload.issueUrl)?.[0]);
    payload.issue = {
      node_id: this.context.payload.issue.node_id,
    };
    const env = this.context.env;

    // Decrypt the private key object
    const privateKeyParsed = await this._parsePrivateKey(this._evmPrivateEncrypted);
    const [isPrivateKeyAllowed, privateKey] = await this._isPrivateKeyAllowed(
      privateKeyParsed,
      this.context.payload.repository.owner.id,
      this.context.payload.repository.id
    );
    if (!isPrivateKeyAllowed) {
      this.context.logger.error("Private key is not allowed to be used in this organization/repository.");
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

    // get the payout mode
    const payoutMode = await this._getPayoutMode(data);
    if (payoutMode === null) {
      throw this.context.logger.warn("Rewards can not be transferred twice.");
    }

    // get reward beneficiaries
    const beneficiaries = await this._getBeneficiaries(result);

    let directTransferError;
    if (payoutMode === "transfer") {
      try {
        // Avoid empty transactions and gas wasting, maybe we should move this logic
        // before this block to avoid any extra works
        if (beneficiaries.length === 0) {
          throw this.context.logger.error("Beneficiary list is empty, skipping the direct transfer of rewards...");
        }

        // Generate the batch transfer nonce
        const nonce = utils.keccak256(utils.toUtf8Bytes(issueId.toString()));

        // Check if funding wallet has enough reward token and gas to transfer rewards directly
        const directTransferInfo = await this._getDirectTransferInfo(beneficiaries, privateKey, nonce);
        this.context.logger.info("Funding wallet has sufficient funds to directly transfer the rewards.");
        const [tx, permits] = await this._transferReward(directTransferInfo);
        this.context.logger.info("Rewards have been transferred.");
        await Promise.all(
          beneficiaries.map(async (beneficiary, idx) => {
            result[beneficiary.username].explorerUrl = `${networkExplorer}/tx/${tx.hash}`;
            result[beneficiary.username].payoutMode = "transfer";
            try {
              await this._savePermitsToDatabase(
                result[beneficiary.username].userId,
                { issueUrl: payload.issueUrl, issueId },
                [permits[idx]]
              );
            } catch (e) {
              this.context.logger.error(`Failed to save permits to the database`, { e });
            }
          })
        );
      } catch (e) {
        this.context.logger.error(`Failed to auto transfer rewards via batch permit transfer`, { e });
        directTransferError = e;
      }
    }

    if (payoutMode === "permit" || directTransferError) {
      this.context.logger.info("Transitioning to permit generation.");
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
          result[username].payoutMode = "permit";
          await this._savePermitsToDatabase(result[username].userId, { issueUrl: payload.issueUrl, issueId }, permits);
          // remove treasury item from final result in order not to display permit fee in GitHub comments
        } catch (e) {
          this.context.logger.error(`Failed to generate permits for user ${username}`, { e });
        }
      }
    }

    // remove treasury item from final result in order not to display permit fee in GitHub comments
    this._removeTreasuryItem(result);
    return result;
  }

  private _removeTreasuryItem(result: Result) {
    if (this.context.env.PERMIT_TREASURY_GITHUB_USERNAME) {
      delete result[this.context.env.PERMIT_TREASURY_GITHUB_USERNAME];
    }
  }

  /* This method returns the transfer mode based on the following conditions:
   - null: Indicates that the payout was previously transferred directly, meaning no further payout is required.
   - permit: Applies if autoTransferMode is set to false or if rewards were previously generated using the permit method.
   - direct: Applies if autoTransferMode is set to true and no previous payout method has been used for the rewards.
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

  async _getNetworkExplorer(networkId: number): Promise<string> {
    const networkExplorer = getNetworkExplorer(String(networkId) as NetworkId);
    if (!networkExplorer || networkExplorer.length === 0) {
      return "https://blockscan.com";
    }
    return networkExplorer[0]?.url;
  }

  async _canMakePayment(data: Readonly<IssueActivity>) {
    if (!data.self?.closed_by || !data.self.user) return false;

    if (await isAdmin(data.self.user.login, this.context)) return true;

    return isCollaborative(data);
  }

  // This method checks that the funding wallet has enough reward tokens for a direct transfer and sufficient funds to cover gas fees.
  async _getDirectTransferInfo(
    beneficiaries: Beneficiary[],
    privateKey: string,
    nonce: string,
    maxRetries = 5,
    initialDelayMs = 500
  ): Promise<DirectTransferInfo> {
    // Initialize contracts and wallet
    const { rewardTokenWrapper, fundingWallet } = await this._initializeContractsAndWallet(
      privateKey,
      maxRetries,
      initialDelayMs
    );

    // Fetch balances and allowances
    const { rewardBalance, rewardAllowance, nativeBalance } = await this._fetchBalancesAndAllowances(
      rewardTokenWrapper,
      fundingWallet
    );

    // Calculate total reward and check if there are enough reward tokens
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

    // Log gas and reward info
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
      throw this.context.logger.error(
        `The funding wallet lacks sufficient reward tokens to perform direct transfers`,
        directTransferLog
      );
    }

    // Check if there is enough gas for the transaction
    const permit2Contract = await getContract(
      this._evmNetworkId,
      permit2Address(this._evmNetworkId),
      PERMIT2_ABI,
      maxRetries,
      initialDelayMs
    );
    const permit2Wrapper = new Permit2Wrapper(permit2Contract);
    const { gasEstimation, batchTransferPermit } = await this._getGasEstimation(
      fundingWallet,
      permit2Wrapper,
      transferRequests,
      nonce
    );

    directTransferLog.gas.required = gasEstimation.toString();
    if (nativeBalance.lte(gasEstimation.mul(2))) {
      throw this.context.logger.error(
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
    };
  }

  // Helper function to initialize contracts and wallet
  private async _initializeContractsAndWallet(privateKey: string, maxRetries = 5, initialDelayMs = 500) {
    const erc20Contract = await getContract(
      this._evmNetworkId,
      this._erc20RewardToken,
      ERC20_ABI,
      maxRetries,
      initialDelayMs
    );
    const fundingWallet = await getEvmWallet(privateKey, erc20Contract.provider);
    const rewardTokenWrapper = new Erc20Wrapper(erc20Contract);
    return { rewardTokenWrapper, fundingWallet };
  }

  // Helper function to fetch balances and allowances
  private async _fetchBalancesAndAllowances(rewardTokenWrapper: Erc20Wrapper, fundingWallet: ethers.Wallet) {
    const rewardBalance = await rewardTokenWrapper.getBalance(fundingWallet.address);
    const rewardAllowance = await rewardTokenWrapper.getAllowance(
      fundingWallet.address,
      permit2Address(this._evmNetworkId)
    );
    const nativeBalance = await fundingWallet.getBalance();
    return { rewardBalance, rewardAllowance, nativeBalance };
  }

  // Helper function to get gas estimation
  private async _getGasEstimation(
    fundingWallet: ethers.Wallet,
    permit2Wrapper: Permit2Wrapper,
    transferRequests: TransferRequest[],
    nonce: string
  ): Promise<{ gasEstimation: BigNumber; batchTransferPermit: BatchTransferPermit }> {
    try {
      const batchTransferPermit = await permit2Wrapper.generateBatchTransferPermit(
        fundingWallet,
        this._erc20RewardToken,
        transferRequests,
        BigNumber.from(nonce)
      );
      const gasEstimation = await permit2Wrapper.estimatePermitTransferFromGas(fundingWallet, batchTransferPermit);
      return { gasEstimation, batchTransferPermit };
    } catch (e) {
      const { error } = decodeError(e);
      throw this.context.logger.error("Gas estimation failed for direct transfer transaction", { error });
    }
  }

  async _getBeneficiaries(result: Result): Promise<Beneficiary[]> {
    const beneficiaries: Beneficiary[] = [];
    for (const [username, reward] of Object.entries(result)) {
      // Obtain the beneficiary wallet address from the github user name
      const { data: userData } = await this.context.octokit.rest.users.getByUsername({ username });
      if (!userData) {
        this.context.logger.error(`GitHub user was not found for id ${username}`);
        continue;
      }
      const userId = userData.id;
      const { data: walletData, error: err } = await this._supabase
        .from("users")
        .select("wallets(*)")
        .eq("id", userId)
        .single();
      if (err || !walletData.wallets?.address) {
        this.context.logger.error("Failed to get wallet", { userId, err, walletData });
        continue;
      }
      beneficiaries.push({
        username: username,
        address: walletData.wallets?.address,
        amount: reward.total,
      });
    }
    return beneficiaries;
  }

  async _transferReward({
    fundingWallet,
    beneficiaries,
    permit2Wrapper,
    batchTransferPermit,
    nonce,
  }: DirectTransferInfo): Promise<[ethers.providers.TransactionResponse, PermitReward[]]> {
    // Executing permitTransferFrom immediately to process the reward transfers.
    try {
      // Perform the Permit2 batch transfer transaction.
      const tx = await permit2Wrapper.sendPermitTransferFrom(fundingWallet, batchTransferPermit);
      this.context.logger.info(`Executed permitTransferFrom contract call, transaction hash: ${tx.hash}`);

      // Wait for the transaction to be confirmed
      const receipt = await tx.wait();
      this.context.logger.info(`Transaction confirmed in block: ${receipt.blockNumber}`);
      const permits = beneficiaries.map(
        (beneficiary) =>
          ({
            tokenType: TokenType.ERC20,
            tokenAddress: this._erc20RewardToken,
            beneficiary: beneficiary.address,
            nonce: nonce,
            deadline: MaxUint256,
            owner: fundingWallet.address,
            signature: batchTransferPermit.signature,
            networkId: this._evmNetworkId,
            amount: beneficiary.amount,
          }) as PermitReward
      );
      return [tx, permits];
    } catch (e) {
      const error = decodeError(e);
      throw this.context.logger.error(`Direct reward transfer failed due to an EVM transaction error`, { error });
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

    // otherwise invalid private key format
    this.context.logger.error("Invalid private key format");
    return [false, null];
  }

  get enabled(): boolean {
    if (!Value.Check(paymentConfigurationType, this._configuration)) {
      this.context.logger.warn("The configuration for the module PaymentModule is invalid or missing, disabling.");
      return false;
    }
    return true;
  }
}
