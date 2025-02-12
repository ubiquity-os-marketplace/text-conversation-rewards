import Decimal from "decimal.js";

/**
 * Calculates the fee based on a net reward amount and a fee rate.
 *
 * Returns the fee as a string formatted to two decimal places.
 * If any values are invalid or out of range, returns "-".
 *
 * @param netReward - The net reward amount (number or Decimal).
 * @param feeRate - The fee percentage (0-100) (number or Decimal).
 * @returns A string containing the fee formatted to two decimals, or "-" on error.
 *
 */
function calculateFeeString(netReward?: number | Decimal, feeRate?: number | Decimal): string {
  if (netReward == null || feeRate == null) return "-";
  const netRewardDecimal = new Decimal(netReward);
  const feeRateDecimal = new Decimal(feeRate);

  if (feeRateDecimal.lessThan(0) || feeRateDecimal.greaterThan(100)) return "-";

  const netFactor = new Decimal(100).minus(feeRateDecimal).div(100);

  if (netFactor.isZero()) return "-";

  const originalReward = netRewardDecimal.div(netFactor);
  const fee = originalReward.minus(netRewardDecimal);

  return fee.toFixed(2);
}

export { calculateFeeString };
