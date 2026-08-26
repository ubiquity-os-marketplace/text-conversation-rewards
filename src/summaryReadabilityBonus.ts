/**
 * UbiquityOS - concise-summary-multiplier
 */
export function calcSummaryBonus(len: number): number { return (len >= 50 && len <= 500) ? 1.2 : 1.0; }
