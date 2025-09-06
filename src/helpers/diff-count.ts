import { diffChars } from "diff";
import Decimal from "decimal.js";
import { UserContentEdits } from "../types/comment-edits";
import { marked, TokensList } from "marked";

/**
 * Sanitize a Markdown body by removing HTML comments that would not be rendered,
 * while preserving those inside code fences and inline code spans where they are
 * meant to appear verbatim.
 */
export function sanitizeMarkdownBody(markdown: string): string {
  if (!markdown) return markdown;

  const tokens: TokensList = marked.lexer(markdown, { gfm: true });
  const resultParts: string[] = [];

  for (const token of tokens) {
    if (token.type === "code" || token.type === "codespan") {
      resultParts.push(token.raw);
      continue;
    }
    if (token.type === "html") {
      const trimmed = token.raw.trim();
      if (/^<!--[\s\S]*?-->$/.test(trimmed)) {
        continue;
      }
      resultParts.push(token.raw);
      continue;
    }
    resultParts.push(token.raw);
  }

  return resultParts.join("");
}

export function getCharacterContributionPercentages(edits: UserContentEdits["nodes"]): Record<string, number> {
  if (edits.length === 0) return {};

  const sanitized = edits.map((e) => ({
    ...e,
    diff: sanitizeMarkdownBody(e.diff ?? ""),
  }));

  let prevText = sanitized[0].diff ?? "";
  const firstUser = sanitized[0].editor;
  let attribution = Array.from(prevText, () => firstUser);

  for (let i = 1; i < sanitized.length; i++) {
    const edit = sanitized[i];
    const { editor, diff: currText } = edit;
    const currUser = editor;
    const diff = diffChars(prevText, currText);

    const newAttribution: UserContentEdits["nodes"][0]["editor"][] = [];
    let prevIdx = 0;

    for (const part of diff) {
      if (part.added) {
        newAttribution.push(...Array.from(part.value, () => currUser));
      } else if (part.removed) {
        prevIdx += part.value.length;
      } else {
        newAttribution.push(...attribution.slice(prevIdx, prevIdx + part.value.length));
        prevIdx += part.value.length;
      }
    }

    prevText = currText;
    attribution = newAttribution;
  }

  const counts = new Map<string, Decimal>();
  let total = new Decimal(0);
  for (const user of attribution) {
    if (!user) continue;
    counts.set(user.login, (counts.get(user.login) || new Decimal(0)).plus(1));
    total = total.plus(1);
  }

  const percentages: Record<string, number> = {};
  for (const [user, count] of counts) {
    percentages[user] = count.dividedBy(total).toDecimalPlaces(3).toNumber();
  }
  return percentages;
}
