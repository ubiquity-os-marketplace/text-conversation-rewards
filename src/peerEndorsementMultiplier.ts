/**
 * UbiquityOS - peer-endorsement-mult
 */
export function calcEndorsementBonus(reactions: number): number { return 1 + (reactions * 0.05); }
