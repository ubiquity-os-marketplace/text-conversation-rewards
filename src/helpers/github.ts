import * as github from "@actions/github";
import ms from "ms";
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

function mapUnit(u: string): "m" | "h" | "d" | "w" | undefined {
  if (u.startsWith("min")) return "m";
  if (u.startsWith("hour")) return "h";
  if (u.startsWith("day")) return "d";
  if (u.startsWith("week")) return "w";
  return undefined;
}

export function parseDurationLabel(
  labels?: GitHubIssue["labels"] | ReadonlyArray<string | { name?: string | null }>
): number | undefined {
  if (!labels) return undefined;

  const re = /^Time:\s*<\s*([\d.]+)\s*(minute|minutes|min|hour|hours|day|days|week|weeks)\b/i;

  for (const label of labels as ReadonlyArray<string | { name?: string | null }>) {
    const name = (typeof label === "string" ? label : label.name) ?? "";
    if (!name.startsWith("Time:")) continue;

    const matched = re.exec(name);
    if (!matched) continue;

    const value = Number(matched[1]);
    const unit = mapUnit(matched[2].toLowerCase());
    if (!(Number.isFinite(value) && value > 0 && unit)) continue;
    const millis = ms(`${value}${unit}`);
    if (typeof millis === "number" && millis > 0) return millis;
  }

  return undefined;
}
