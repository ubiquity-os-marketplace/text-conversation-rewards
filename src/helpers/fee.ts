import Decimal from "decimal.js";

export function generateFeeString(reward: number | Decimal | undefined, feeRate: number | Decimal | undefined) {
  if (!reward || !feeRate) return "-";
  const originalReward = new Decimal(reward).div(new Decimal(feeRate));
  return originalReward.minus(new Decimal(reward)).toFixed(2);
}
