import { diffChars } from "diff";
import Decimal from "decimal.js";
import file from "../../tests/__mocks__/routes/diffs/edits.json";

type Edit = {
  editor: {
    login?: string;
    botLogin?: string;
  };
  diff: string;
};

function getCharacterContributionPercentages(edits: Edit[]): Record<string, number> {
  if (edits.length === 0) return {};

  function getUser(editor: Edit["editor"]): string | undefined {
    return editor.botLogin || editor.login;
  }

  let prevText = edits[0].diff;
  const firstUser = getUser(edits[0].editor);
  let attribution: (string | undefined)[] = Array.from(prevText, () => firstUser);

  for (let i = 1; i < edits.length; i++) {
    const { editor, diff: currText } = edits[i];
    const currUser = getUser(editor);
    const diff = diffChars(prevText, currText);

    const newAttribution: (string | undefined)[] = [];
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
    counts.set(user, (counts.get(user) || new Decimal(0)).plus(1));
    total = total.plus(1);
  }

  const percentages: Record<string, number> = {};
  for (const [user, count] of counts) {
    percentages[user] = count.dividedBy(total).toDecimalPlaces(3).toNumber();
  }
  return percentages;
}

console.log(getCharacterContributionPercentages(file.repository.issue.userContentEdits.nodes));
