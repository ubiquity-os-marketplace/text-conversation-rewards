import { GitHubIssue } from "../github-types";
import { ContextPlugin } from "../types/plugin-input";
import { LINKED_ISSUES, PullRequestClosingIssue } from "../types/requests";

type IssueLabel = NonNullable<GitHubIssue["labels"]>[number];
type ClosingIssueEdge =
  PullRequestClosingIssue["repository"]["pullRequest"]["closingIssuesReferences"]["edges"][number];

export function getSortedPrices(labels: GitHubIssue["labels"] | undefined) {
  if (!labels) return [];
  const sortedPriceLabels = labels
    .reduce((acc, label: IssueLabel) => {
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
export async function getTaskReward(context: ContextPlugin, issue: GitHubIssue | null) {
  if (issue) {
    if (issue.pull_request) {
      const linkedIssues = await context.octokit.graphql.paginate<PullRequestClosingIssue>(LINKED_ISSUES, {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        pull_number: issue.number,
      });

      const perIssueMinimums = linkedIssues.repository.pullRequest.closingIssuesReferences.edges
        .map((edge: ClosingIssueEdge) => getSortedPrices(edge.node.labels?.nodes))
        .filter((prices: number[]) => prices.length)
        .map((prices: number[]) => prices[0]);

      if (perIssueMinimums.length) {
        return Math.max(...perIssueMinimums);
      }
    } else {
      const sortedPriceLabels = getSortedPrices(issue.labels);
      if (sortedPriceLabels.length) {
        return sortedPriceLabels[0];
      }
    }
  }

  return 0;
}
