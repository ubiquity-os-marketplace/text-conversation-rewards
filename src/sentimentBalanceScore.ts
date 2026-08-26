/**
 * UbiquityOS - sentiment-balance-score
 */
export function calcToneMultiplier(score: number): number { return score > 0 ? 1.2 : 1.0; }
