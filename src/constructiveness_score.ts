export function calculateConstructivenessMultiplier(helpfulKeywordsCount: number, codeBlockCount: number): number {
  let multiplier = 1.0;
  if (codeBlockCount > 0) multiplier += 0.2;
  if (helpfulKeywordsCount >= 3) multiplier += 0.3;
  return Math.min(multiplier, 2.0);
}
