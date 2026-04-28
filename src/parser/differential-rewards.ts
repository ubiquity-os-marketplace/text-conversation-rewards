import { Context } from "@ubiquity-os/permit-generation";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../adapters/supabase/types/database";
import { Beneficiary, Result, ResultEntry } from "../types/results";

interface PreviousDistribution {
  beneficiary: string;
  amount: number;
  transactionHash: string | null;
  payoutMode: "direct" | "permit";
}

interface DistributionDifference {
  beneficiary: string;
  previousAmount: number;
  newAmount: number;
  difference: number;
  shouldDistribute: boolean;
}

/**
 * Tracks and computes differential rewards for reopened issues.
 * When an issue is reopened and closed again, only the difference
 * between previously distributed rewards and new rewards should be paid.
 */
export class DifferentialRewardTracker {
  private _supabase;
  private _logger;

  constructor(context: Context, supabaseUrl: string, supabaseKey: string) {
    this._supabase = createClient<Database>(supabaseUrl, supabaseKey);
    this._logger = context.logger;
  }

  /**
   * Fetch previous distributions for an issue from Supabase
   */
  async getPreviousDistributions(issueNodeId: string): Promise<PreviousDistribution[]> {
    const { data, error } = await this._supabase
      .from("permits")
      .select("beneficiary, amount, transaction, payout_mode")
      .eq("issue_node_id", issueNodeId)
      .eq("status", "completed");

    if (error) {
      this._logger.warn("Failed to fetch previous distributions", { err: error });
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((row: Record<string, unknown>) => ({
      beneficiary: row.beneficiary as string,
      amount: Number(row.amount) || 0,
      transactionHash: row.transaction as string | null,
      payoutMode: (row.payout_mode as "direct" | "permit") || "permit",
    }));
  }

  /**
   * Compute the difference between new rewards and previously distributed rewards.
   * Only returns beneficiaries with a positive difference.
   */
  computeDifferences(newRewards: Result, previousDistributions: PreviousDistribution[]): Result {
    const differences: Result = {};

    // Build lookup of previous amounts per beneficiary
    const previousMap = new Map<string, number>();
    for (const prev of previousDistributions) {
      const existing = previousMap.get(prev.beneficiary) || 0;
      previousMap.set(prev.beneficiary, existing + prev.amount);
    }

    // Calculate difference for each beneficiary in new rewards
    for (const [beneficiary, entries] of Object.entries(newRewards)) {
      const previousAmount = previousMap.get(beneficiary) || 0;
      const newTotal = this._calculateTotalReward(entries);
      const difference = newTotal - previousAmount;

      this._logger.info(`Differential calculation for ${beneficiary}:`, {
        previousAmount,
        newTotal,
        difference,
      });

      if (difference > 0) {
        // Scale down all reward entries proportionally
        const scaleFactor = difference / newTotal;
        differences[beneficiary] = this._scaleRewards(entries, scaleFactor);
      } else {
        this._logger.info(`Skipping ${beneficiary}: no additional reward (difference: ${difference})`);
      }
    }

    return differences;
  }

  /**
   * Record a distribution in the history for future differential calculations
   */
  async recordDistribution(
    issueNodeId: string,
    beneficiary: string,
    amount: number,
    payoutMode: "direct" | "permit",
    transactionHash: string | null = null
  ): Promise<void> {
    const { error } = await this._supabase.from("distribution_history").upsert({
      issue_node_id: issueNodeId,
      beneficiary,
      amount: amount.toString(),
      payout_mode: payoutMode,
      transaction_hash: transactionHash,
      created_at: new Date().toISOString(),
    });

    if (error) {
      this._logger.warn("Failed to record distribution history", { err: error });
    }
  }

  /**
   * Calculate total reward amount from result entries
   */
  private _calculateTotalReward(entries: ResultEntry): number {
    let total = 0;
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (typeof entry === "object" && "reward" in entry) {
          total += Number((entry as { reward: number }).reward) || 0;
        } else if (typeof entry === "number") {
          total += entry;
        }
      }
    }
    return total;
  }

  /**
   * Scale reward entries by a factor (for differential distribution)
   */
  private _scaleRewards(entries: ResultEntry, scaleFactor: number): ResultEntry {
    if (Array.isArray(entries)) {
      return entries.map((entry) => {
        if (typeof entry === "object" && "reward" in entry) {
          return { ...entry, reward: Math.round((entry as { reward: number }).reward * scaleFactor * 100) / 100 };
        }
        return typeof entry === "number" ? Math.round(entry * scaleFactor * 100) / 100 : entry;
      });
    }
    return entries;
  }
}
