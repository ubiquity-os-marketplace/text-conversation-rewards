/**
 * Differential Reward Distribution Module
 * 
 * Issue: https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/301
 * 
 * When an issue is reopened and closed again, calculate and distribute only the
 * difference between previously granted rewards and new rewards.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../adapters/supabase/types/database";
import { Result } from "../types/results";
import { IssueActivity } from "../issue-activity";
import { ContextPlugin } from "../types/plugin-input";

export interface DistributionRecord {
  issueId: number;
  locationId: number;
  beneficiaryId: number;
  amount: number;
  payoutMode: 'transfer' | 'permit';
  transactionHash?: string;
  permitId?: number;
  distributionRound: number;
}

export interface DifferentialResult {
  username: string;
  previousTotal: number;
  newAmount: number;
  difference: number;
  shouldPay: boolean;
}

export class DifferentialDistribution {
  private readonly _supabase;

  constructor(private readonly context: ContextPlugin) {
    this._supabase = createClient<Database>(
      this.context.env.SUPABASE_URL,
      this.context.env.SUPABASE_KEY
    );
  }

  /**
   * Calculate differential rewards for all beneficiaries
   * 
   * Compares new reward amounts with previously distributed amounts
   * and returns only positive differences.
   */
  async calculateDifferentials(
    data: Readonly<IssueActivity>,
    result: Result
  ): Promise<DifferentialResult[]> {
    const issueId = this._extractIssueId(data);
    if (!issueId) {
      this.context.logger.warn("Could not extract issue ID for differential calculation");
      return [];
    }

    const differentials: DifferentialResult[] = [];

    for (const [username, rewardData] of Object.entries(result)) {
      if (!rewardData?.userId || !rewardData?.total) {
        continue;
      }

      const previousTotal = await this._getPreviousDistributedAmount(
        issueId,
        rewardData.userId
      );

      const difference = rewardData.total - previousTotal;
      const shouldPay = difference > 0;

      differentials.push({
        username,
        previousTotal,
        newAmount: rewardData.total,
        difference,
        shouldPay
      });

      this.context.logger.info(`Differential calculation for ${username}:`, {
        previousTotal,
        newAmount: rewardData.total,
        difference,
        shouldPay
      });
    }

    return differentials;
  }

  /**
   * Filter result to only include beneficiaries with positive differences
   */
  async filterPositiveDifferences(
    data: Readonly<IssueActivity>,
    result: Result
  ): Promise<Result> {
    const differentials = await this.calculateDifferentials(data, result);
    const filteredResult: Result = {};

    for (const diff of differentials) {
      if (diff.shouldPay && result[diff.username]) {
        // Update the total to only the difference amount
        filteredResult[diff.username] = {
          ...result[diff.username],
          total: diff.difference,
          metadata: {
            ...result[diff.username]?.metadata,
            previousTotal: diff.previousTotal,
            newAmount: diff.newAmount,
            difference: diff.difference,
            distributionRound: await this._getNextDistributionRound(
              this._extractIssueId(data)!
            )
          }
        };
      }
    }

    this.context.logger.info(`Filtered from ${Object.keys(result).length} to ${Object.keys(filteredResult).length} beneficiaries`);

    return filteredResult;
  }

  /**
   * Record a distribution in the database
   */
  async recordDistribution(
    issueId: number,
    locationId: number,
    beneficiaryId: number,
    amount: number,
    payoutMode: 'transfer' | 'permit',
    transactionHash?: string,
    permitId?: number
  ): Promise<{ success: boolean; distributionRound: number; error?: string }> {
    try {
      const { data: result, error } = await this._supabase.rpc(
        'insert_distribution',
        {
          p_issue_id: issueId,
          p_location_id: locationId,
          p_beneficiary_id: beneficiaryId,
          p_new_amount: amount,
          p_payout_mode: payoutMode,
          p_transaction_hash: transactionHash || null,
          p_permit_id: permitId || null
        }
      );

      if (error) {
        this.context.logger.error("Failed to record distribution", { error });
        return { success: false, distributionRound: 0, error: error.message };
      }

      return {
        success: result?.success || false,
        distributionRound: result?.distribution_round || 0
      };
    } catch (e) {
      this.context.logger.error("Exception while recording distribution", { e });
      return { success: false, distributionRound: 0, error: String(e) };
    }
  }

  /**
   * Get the total amount previously distributed to a beneficiary for an issue
   */
  private async _getPreviousDistributedAmount(
    issueId: number,
    beneficiaryId: number
  ): Promise<number> {
    try {
      const { data, error } = await this._supabase.rpc('get_total_distributed', {
        p_issue_id: issueId,
        p_beneficiary_id: beneficiaryId
      });

      if (error) {
        this.context.logger.warn("Could not fetch previous distribution amount", { error });
        return 0;
      }

      return Number(data) || 0;
    } catch (e) {
      this.context.logger.warn("Exception fetching previous distribution", { e });
      return 0;
    }
  }

  /**
   * Get the next distribution round number for an issue
   */
  private async _getNextDistributionRound(issueId: number): Promise<number> {
    try {
      const { data, error } = await this._supabase.rpc('get_latest_distribution_round', {
        p_issue_id: issueId
      });

      if (error) {
        this.context.logger.warn("Could not fetch distribution round", { error });
        return 1;
      }

      return (Number(data) || 0) + 1;
    } catch (e) {
      this.context.logger.warn("Exception fetching distribution round", { e });
      return 1;
    }
  }

  /**
   * Extract issue ID from IssueActivity
   */
  private _extractIssueId(data: Readonly<IssueActivity>): number | null {
    if (data.self?.number) {
      return data.self.number;
    }
    
    const url = data.self?.html_url || '';
    const match = url.match(/\/issues\/(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Generate a summary comment for GitHub showing differential distribution
   */
  generateDistributionComment(
    differentials: DifferentialResult[],
    payoutMode: 'transfer' | 'permit'
  ): string {
    const lines = [
      '## 💰 Differential Reward Distribution',
      '',
      'This issue was previously closed and rewards were distributed. Upon reopening, only the **difference** in rewards is being distributed.',
      '',
      '| User | Previous | New Amount | **Difference** | Status |',
      '|------|----------|------------|----------------|--------|'
    ];

    for (const diff of differentials) {
      const status = diff.shouldPay 
        ? `✅ +${diff.difference.toFixed(2)}` 
        : '⏭️ No change';
      
      lines.push(
        `| ${diff.username} | ${diff.previousTotal.toFixed(2)} | ${diff.newAmount.toFixed(2)} | **${diff.difference.toFixed(2)}** | ${status} |`
      );
    }

    const totalDifference = differentials
      .filter(d => d.shouldPay)
      .reduce((sum, d) => sum + d.difference, 0);

    lines.push(
      '',
      `**Total Distribution**: ${totalDifference.toFixed(2)} tokens`,
      `**Payout Mode**: ${payoutMode}`,
      '',
      '<details>',
      '<summary>ℹ️ How differential distribution works</summary>',
      '',
      'When an issue is reopened and closed again:',
      '1. Previous reward amounts are retrieved from distribution history',
      '2. New reward amounts are calculated based on current contributions',
      '3. Only the positive difference is distributed (if any)',
      '4. Users with no additional contributions receive nothing',
      '',
      '</details>'
    );

    return lines.join('\n');
  }
}
