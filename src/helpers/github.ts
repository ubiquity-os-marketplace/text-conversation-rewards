import * as github from "@actions/github";
import ms, { UnitAnyCase } from "ms";

type Labels = ReadonlyArray<string | { name?: string | null }>;

export function getGithubWorkflowRunUrl() {
  return `${github.context.payload.repository?.html_url}/actions/runs/${github.context.runId}`;
}

export function parsePriorityLabel(labels?: Labels) {
  if (!labels) return 1;

  for (const label of labels) {
    const priorityLabel = typeof label === "string" ? label : label.name;
    const matched = priorityLabel?.match(/^Priority:\s*(\d+)/i);

    if (matched && Number.isFinite(Number(matched[1]))) {
      return Number(matched[1]);
    }
  }

  return 1;
}

export function parseDurationLabel(labels?: Labels): number | undefined {
  if (!labels) return undefined;

  const re = /^Time\b\s*:?\s*<?\s*(\d+(?:\.\d+)?)\s*([a-z]+)\b/i;

  for (const label of labels) {
    const name = (typeof label === "string" ? label : label.name) ?? "";

    const matched = re.exec(name);
    if (!matched) continue;

    const number = Number(matched[1]);
    const unit = matched[2] as UnitAnyCase;

    return ms(`${number} ${unit}`);
  }

  return undefined;
}

function normalizeLogin(login?: string | null) {
  if (!login) return null;
  const trimmed = login.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

export type SpecialUserGroup = ReadonlyArray<string>;

export function areLoginsEquivalent(
  loginA: string | null | undefined,
  loginB: string | null | undefined,
  specialUserGroups: ReadonlyArray<SpecialUserGroup> = []
): boolean {
  const normalizedA = normalizeLogin(loginA);
  const normalizedB = normalizeLogin(loginB);

  if (!normalizedA || !normalizedB) {
    return false;
  }

  if (normalizedA === normalizedB) {
    return true;
  }

  return specialUserGroups.some((group) => {
    if (!Array.isArray(group) || group.length === 0) {
      return false;
    }
    const normalizedMembers = group
      .map((member) => normalizeLogin(member))
      .filter((member): member is string => Boolean(member));
    if (normalizedMembers.length < 2) {
      return false;
    }
    return normalizedMembers.includes(normalizedA) && normalizedMembers.includes(normalizedB);
  });
}
