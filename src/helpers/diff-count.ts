import { diffChars } from "diff";
import Decimal from "decimal.js";
import { UserContentEdits } from "../types/comment-edits";

export function getCharacterContributionPercentages(edits: UserContentEdits["nodes"]): Record<string, number> {
  if (edits.length === 0) return {};

  let prevText = edits[0].diff;
  const firstUser = edits[0].editor;
  let attribution = Array.from(prevText, () => firstUser);

  for (const edit of edits) {
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
