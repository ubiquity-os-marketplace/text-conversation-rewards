export function calculateDuplicateSpamPenalty(commentSimilarityRatio: number, baseScore: number): number {
  if (commentSimilarityRatio > 0.85) return 0;
  if (commentSimilarityRatio > 0.6) return baseScore * 0.5;
  return baseScore;
}
