import { GitHubIssue } from "../github-types";

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

export function parsePriorityLabel(
  labels:
    | (
        | string
        | {
            id?: number;
            node_id?: string;
            url?: string;
            name?: string;
            description?: string | null;
            color?: string | null;
            default?: boolean;
          }
      )[]
    | undefined
): number {
  let taskPriorityEstimate = 0;
  if (!labels) return 1;
  for (const label of labels) {
    let priorityLabel = "";
    if (typeof label === "string") {
      priorityLabel = label;
    } else {
      priorityLabel = label.name ?? "";
    }

    if (priorityLabel.startsWith("Priority:")) {
      const matched = priorityLabel.match(/Priority: (\d+)/i);
      if (!matched) {
        return 0;
      }

      const urgency = matched[1];
      taskPriorityEstimate = Number(urgency);
    }

    if (taskPriorityEstimate) {
      break;
    }
  }

  return taskPriorityEstimate;
}
