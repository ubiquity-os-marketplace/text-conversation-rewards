export function validatePermitValues(amount: bigint, maxReward: bigint): boolean {
  return amount > 0n && amount <= maxReward;
}
