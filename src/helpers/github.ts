import * as github from "@actions/github";
import ms, { UnitAnyCase } from "ms";
import { GitHubIssue } from "../github-types";

export function getGithubWorkflowRunUrl() {
  return `${github.context.payload.repository?.html_url}/actions/runs/${github.context.runId}`;
}

export function parsePriorityLabel(labels?: GitHubIssue["labels"] | ReadonlyArray<string | { name?: string | null }>) {
  if (!labels) return 1;

  for (const label of labels as ReadonlyArray<string | { name?: string | null }>) {
    const priorityLabel = typeof label === "string" ? label : label.name;
    const matched = priorityLabel?.match(/^Priority:\s*(\d+)/i);

    if (matched && Number.isFinite(Number(matched[1]))) {
      return Number(matched[1]);
    }
  }

  return 1;
}

export function parseDurationLabel(
  labels?: GitHubIssue["labels"] | ReadonlyArray<string | { name?: string | null }>
): number | undefined {
  if (!labels) return undefined;

  const re = /^Time\b\s*:?\s*<?\s*(\d+(?:\.\d+)?)\s*([a-z]+)\b/i;

  for (const label of labels as ReadonlyArray<string | { name?: string | null }>) {
    const name = (typeof label === "string" ? label : label.name) ?? "";
    if (!/^Time\b/i.test(name)) continue;

    const matched = re.exec(name);
    if (!matched) continue;

    const number = Number(matched[1]);
    const unit = matched[2] as UnitAnyCase;

    return ms(`${number} ${unit}`);
  }

  return undefined;
}
