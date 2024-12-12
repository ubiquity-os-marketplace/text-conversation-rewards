import { GitHubIssue } from "../github-types";
import { Result } from "../types/results";

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

/*
 * Returns the associated task reward of the issue, based on the final task reward taking into account any multipliers
 * applied. If no task reward is found, falls back to the task price. If no task price is found, returns 0.
 */
export function getTaskReward(issue: GitHubIssue | null, result: Result) {
  const taskReward = Object.values(result).reduce((acc, curr) => {
    if (curr.task) {
      return curr.task.reward * curr.task.multiplier;
    }
    return acc;
  }, 0);

  if (taskReward === 0 && issue) {
    const sortedPriceLabels = getSortedPrices(issue.labels);
    if (sortedPriceLabels.length) {
      return sortedPriceLabels[0];
    }
  }

  return taskReward;
}
