import Decimal from "decimal.js";

export function generateFeeString(reward: number | Decimal, feeRate: number | Decimal) {
  const originalReward = new Decimal(reward).div(new Decimal(feeRate));
  return originalReward.sub(new Decimal(reward)).toFixed(2);
}
