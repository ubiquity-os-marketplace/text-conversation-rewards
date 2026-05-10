/**
 * Task 07: Credit for Research - Reward system for research contributions
 *
 * Issue: https://github.com/ubiquity-os-marketplace/text-conversation-rewards/issues/296
 *
 * System for awarding credits to contributors for research work.
 */

// ============================================
// Types and Configuration
// ============================================

type ResearchType = 'documentation' | 'analysis' | 'proposal' | 'review';
type QualityLevel = 'standard' | 'high' | 'exceptional';

interface ResearchContribution {
  id: string;
  contributorId: string;
  type: ResearchType;
  hours: number;
  quality: QualityLevel;
  description: string;
  evidence?: string[];
  timestamp: Date;
}

interface CreditEntry {
  id: string;
  contributionId: string;
  contributorId: string;
  amount: number;
  reason: string;
  timestamp: Date;
}

// Credit rates per hour by type and quality
const CREDIT_RATES: Record<ResearchType, Record<QualityLevel, number>> = {
  documentation: { standard: 10, high: 15, exceptional: 25 },
  analysis: { standard: 15, high: 25, exceptional: 40 },
  proposal: { standard: 20, high: 35, exceptional: 50 },
  review: { standard: 5, high: 10, exceptional: 15 },
};

// ============================================
// Credit Calculator
// ============================================

export class CreditCalculator {
  /**
   * Calculate credits for a research contribution
   */
  calculateCredits(contribution: ResearchContribution): number {
    const baseRate = CREDIT_RATES[contribution.type][contribution.quality];
    const totalCredits = Math.round(baseRate * contribution.hours);

    return totalCredits;
  }

  /**
   * Get credit rate for a specific type and quality
   */
  getRate(type: ResearchType, quality: QualityLevel): number {
    return CREDIT_RATES[type][quality];
  }

  /**
   * Estimate credits based on hours and type
   */
  estimateCredits(type: ResearchType, hours: number): {
    standard: number;
    high: number;
    exceptional: number;
  } {
    return {
      standard: CREDIT_RATES[type].standard * hours,
      high: CREDIT_RATES[type].high * hours,
      exceptional: CREDIT_RATES[type].exceptional * hours,
    };
  }
}

// ============================================
// Research Credit System
// ============================================

export class ResearchCreditSystem {
  private contributions: Map<string, ResearchContribution> = new Map();
  private credits: Map<string, CreditEntry[]> = new Map();
  private calculator: CreditCalculator;

  constructor() {
    this.calculator = new CreditCalculator();
  }

  /**
   * Submit a research contribution
   */
  submitContribution(contribution: Omit<ResearchContribution, 'id' | 'timestamp'>): string {
    const id = this.generateId();

    const fullContribution: ResearchContribution = {
      ...contribution,
      id,
      timestamp: new Date(),
    };

    this.contributions.set(id, fullContribution);

    // Automatically award credits
    this.awardCredits(fullContribution);

    return id;
  }

  /**
   * Award credits for a contribution
   */
  private awardCredits(contribution: ResearchContribution): CreditEntry {
    const amount = this.calculator.calculateCredits(contribution);

    const creditEntry: CreditEntry = {
      id: this.generateId(),
      contributionId: contribution.id,
      contributorId: contribution.contributorId,
      amount,
      reason: `Research: ${contribution.type} - ${contribution.quality} quality`,
      timestamp: new Date(),
    };

    // Store credit entry
    if (!this.credits.has(contribution.contributorId)) {
      this.credits.set(contribution.contributorId, []);
    }

    this.credits.get(contribution.contributorId)!.push(creditEntry);

    console.log(`[Credits] Awarded ${amount} credits to ${contribution.contributorId} for ${contribution.type}`);

    return creditEntry;
  }

  /**
   * Get total credits for a contributor
   */
  getTotalCredits(contributorId: string): number {
    const entries = this.credits.get(contributorId) ?? [];
    return entries.reduce((sum, entry) => sum + entry.amount, 0);
  }

  /**
   * Get credit history for a contributor
   */
  getCreditHistory(contributorId: string): CreditEntry[] {
    return this.credits.get(contributorId) ?? [];
  }

  /**
   * Get contribution by ID
   */
  getContribution(id: string): ResearchContribution | undefined {
    return this.contributions.get(id);
  }

  /**
   * Get all contributions by a contributor
   */
  getContributionsByUser(contributorId: string): ResearchContribution[] {
    return Array.from(this.contributions.values())
      .filter(c => c.contributorId === contributorId);
  }

  /**
   * Generate leaderboard
   */
  getLeaderboard(limit: number = 10): Array<{ contributorId: string; totalCredits: number }> {
    const totals: Array<{ contributorId: string; totalCredits: number }> = [];

    for (const [contributorId] of this.credits) {
      totals.push({
        contributorId,
        totalCredits: this.getTotalCredits(contributorId),
      });
    }

    return totals
      .sort((a, b) => b.totalCredits - a.totalCredits)
      .slice(0, limit);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================
// Helper functions for quality assessment
// ============================================

export function assessQuality(contribution: {
  description: string;
  evidence?: string[];
  hours: number;
}): QualityLevel {
  let score = 0;

  // Check description length and detail
  if (contribution.description.length > 500) score += 1;
  if (contribution.description.length > 1000) score += 1;

  // Check evidence
  if (contribution.evidence && contribution.evidence.length > 0) score += 1;
  if (contribution.evidence && contribution.evidence.length > 2) score += 1;

  // Check time investment
  if (contribution.hours >= 2) score += 1;
  if (contribution.hours >= 5) score += 1;

  // Map score to quality level
  if (score >= 5) return 'exceptional';
  if (score >= 3) return 'high';
  return 'standard';
}

// ============================================
// Usage examples
// ============================================

const creditSystem = new ResearchCreditSystem();

// Example 1: Submit documentation contribution
const docContributionId = creditSystem.submitContribution({
  contributorId: 'user-alice',
  type: 'documentation',
  hours: 3,
  quality: 'high',
  description: 'Created comprehensive API documentation for the new endpoints',
  evidence: ['https://github.com/org/repo/pull/123', 'https://docs.example.com/new-api'],
});

// Example 2: Submit analysis contribution
const analysisContributionId = creditSystem.submitContribution({
  contributorId: 'user-bob',
  type: 'analysis',
  hours: 5,
  quality: 'exceptional',
  description: 'Deep analysis of performance bottlenecks with optimization recommendations',
  evidence: ['analysis-report.pdf', 'benchmark-results.json'],
});

// Example 3: Get total credits
const aliceCredits = creditSystem.getTotalCredits('user-alice');
console.log(`Alice has ${aliceCredits} credits`);

// Example 4: Get leaderboard
const leaderboard = creditSystem.getLeaderboard(5);
console.log('Top contributors:', leaderboard);

// Example 5: Estimate credits before submitting
const calculator = new CreditCalculator();
const estimate = calculator.estimateCredits('proposal', 4);
console.log(`Estimated credits for 4-hour proposal: ${estimate}`);

// ============================================
// Export
// ============================================

export {
  CREDIT_RATES,
  type ResearchContribution,
  type CreditEntry,
  type ResearchType,
  type QualityLevel,
};
