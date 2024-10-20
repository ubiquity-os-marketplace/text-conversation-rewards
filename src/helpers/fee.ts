import Decimal from "decimal.js";

export function generateFeeString(reward: number | Decimal | undefined, feeRate: number | Decimal | undefined) {
  if (!reward || !feeRate) return "-";
  const feeRateDecimal = new Decimal(1).minus(new Decimal(feeRate));
  const originalReward = new Decimal(reward).div(feeRateDecimal);
  const fee = originalReward.minus(new Decimal(reward));
  return fee.toFixed(2);
}
