import * as github from "@actions/github";
import { GitHubIssue } from "../github-types";

export function getGithubWorkflowRunUrl() {
  return `${github.context.payload.repository?.html_url}/actions/runs/${github.context.runId}`;
}

export function parsePriorityLabel(labels?: GitHubIssue["labels"]) {
  if (!labels) return 1;

  for (const label of labels) {
    const priorityLabel = typeof label === "string" ? label : label.name;
    const matched = priorityLabel?.match(/^Priority:\s*(\d+)/);

    if (matched && Number.isFinite(Number(matched[1]))) {
      return Number(matched[1]);
    }
  }

  return 1;
}
