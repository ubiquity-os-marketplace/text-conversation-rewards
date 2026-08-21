export function filterBurstReactions(
	reactions: Array<{ user: string; timestamp: number }>,
	windowMs = 5000,
): number {
	return reactions.filter(
		(r, idx, arr) =>
			idx === 0 || r.timestamp - arr[idx - 1].timestamp > windowMs,
	).length;
}
