import * as github from "@actions/github";
import { GitHubIssue } from "../github-types";

export function getGithubWorkflowRunUrl() {
  return `${github.context.payload.repository?.html_url}/actions/runs/${github.context.runId}`;
}

export function parsePriorityLabel(labels: GitHubIssue["labels"] | undefined) {
  if (!labels) return 1;

  for (const label of labels) {
    const priorityLabel = typeof label === "string" ? label : (label.name ?? "");
    const matched = priorityLabel.match(/^Priority:\s*(\d+)/i);

    if (matched) {
      const urgency = Number(matched[1]);
      if (urgency) return urgency;
    }
  }

  return 1;
}
