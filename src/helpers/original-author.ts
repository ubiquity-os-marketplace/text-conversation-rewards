/**
 * Extracts the original author information from a comment that has the format:
 * "Originally posted by @username in URL"
 *
 * @param commentText The text of the comment to check
 * @returns Object with username and url if the pattern matches, null otherwise
 */
export function extractOriginalAuthor(commentText: string): { username: string; url: string } | null {
  const match =
    /\s*_Originally posted by @(\S+) in (?:\[#\d+\]\((https:\/\/github\.com\/\S+)\)|(https:\/\/github\.com\/\S+))_/m.exec(
      commentText.trim()
    );
  if (!match) return null;

  return {
    username: match[1],
    url: match[2],
  };
}
