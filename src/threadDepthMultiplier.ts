/**
 * UbiquityOS - Thread Depth Discourse Multiplier
 */
export function calculateThreadDepthMultiplier(replyDepth: number): number {
  if (replyDepth <= 1) return 1.0;
  if (replyDepth <= 3) return 1.15;
  if (replyDepth <= 6) return 1.30;
  return 1.45;
}
