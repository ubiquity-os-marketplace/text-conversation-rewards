import { GitHubIssue } from "../github-types.ts";

export function getSortedPrices(labels: GitHubIssue["labels"] | undefined) {
  if (!labels) return [];
  const sortedPriceLabels = labels
    .reduce((acc, label) => {
      const labelName = typeof label === "string" ? label : label.name;
      if (labelName?.startsWith("Price: ")) {
        const price = parseFloat(labelName.replace("Price: ", ""));
        if (!isNaN(price)) {
          acc.push(price);
        }
      }
      return acc;
    }, [] as number[])
    .sort((a, b) => a - b);
  if (!sortedPriceLabels.length) {
    console.warn("There are no price labels in this repository.");
    return [];
  }
  return sortedPriceLabels;
}
