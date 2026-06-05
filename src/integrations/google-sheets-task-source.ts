import { GitHubIssue, GitHubIssueComment, GitHubIssueEvent } from "../github-types";
import { ContextPlugin } from "../types/plugin-input";

type GoogleSheetsConfig = NonNullable<ContextPlugin["config"]["dataCollection"]["googleSheets"]>;

type SheetRow = Record<string, string>;

export type GoogleSheetsTaskActivity = {
  self: GitHubIssue;
  comments: GitHubIssueComment[];
  events: GitHubIssueEvent[];
};

function parseCsv(text: string): SheetRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let isQuoted = false;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (isQuoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 2;
        continue;
      } else if (char === '"') {
        isQuoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      isQuoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
    index += 1;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) ?? [];
  return rows
    .filter((cells) => cells.some((cell) => cell.trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() ?? ""])));
}

function stableNumber(value: string) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash || 1;
}

function user(login: string) {
  const safeLogin = login || "unknown";
  return {
    id: stableNumber(safeLogin),
    login: safeLogin,
    type: "User",
    html_url: `https://github.com/${safeLogin}`,
  };
}

function getPayloadIssueUrl(context: ContextPlugin) {
  if ("issue" in context.payload) {
    return context.payload.issue.html_url;
  }
  return context.payload.pull_request.html_url;
}

function buildSelf(context: ContextPlugin, config: GoogleSheetsConfig, firstRow: SheetRow, taskRows: SheetRow[]) {
  const taskId = firstRow[config.taskIdColumn] || config.taskId;
  const taskUrl = firstRow[config.urlColumn] || getPayloadIssueUrl(context);
  const author = firstRow[config.authorColumn] || context.payload.sender.login;
  const assigneeLogin = firstRow[config.assigneeColumn];
  const priceLabel = firstRow[config.priceLabelColumn];

  return {
    id: stableNumber(taskId),
    number: stableNumber(taskId),
    title: firstRow[config.titleColumn] || taskId,
    body: firstRow[config.bodyColumn] || "",
    html_url: taskUrl,
    created_at: firstRow[config.createdAtColumn] || new Date(0).toISOString(),
    user: user(author),
    assignee: assigneeLogin ? user(assigneeLogin) : null,
    assignees: assigneeLogin ? [user(assigneeLogin)] : [],
    labels: priceLabel ? [{ name: priceLabel }] : [],
    state: "closed",
    state_reason: "completed",
    comments: taskRows.length,
  } as unknown as GitHubIssue;
}

function buildComment(context: ContextPlugin, config: GoogleSheetsConfig, row: SheetRow, index: number) {
  const taskId = row[config.taskIdColumn] || config.taskId;
  const commentId = row[config.commentIdColumn] || `${taskId}-${index + 1}`;
  const taskUrl = row[config.urlColumn] || getPayloadIssueUrl(context);
  const author = row[config.authorColumn] || context.payload.sender.login;

  return {
    id: stableNumber(commentId),
    body: row[config.bodyColumn] || "",
    html_url: `${taskUrl}#sheet-comment-${stableNumber(commentId)}`,
    created_at: row[config.createdAtColumn] || new Date(0).toISOString(),
    updated_at: row[config.createdAtColumn] || new Date(0).toISOString(),
    user: user(author),
    author_association: "CONTRIBUTOR",
  } as unknown as GitHubIssueComment;
}

export async function loadGoogleSheetsTaskActivity(
  context: ContextPlugin,
  config: GoogleSheetsConfig
): Promise<GoogleSheetsTaskActivity> {
  const response = await fetch(config.csvUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Google Sheets CSV: ${response.status}`);
  }

  const rows = parseCsv(await response.text());
  const taskRows = rows.filter((row) => row[config.taskIdColumn] === config.taskId);
  if (!taskRows.length) {
    throw new Error(`No Google Sheets rows matched task id "${config.taskId}" in column "${config.taskIdColumn}".`);
  }

  const firstRow = taskRows[0];
  return {
    self: buildSelf(context, config, firstRow, taskRows),
    comments: taskRows
      .filter((row) => row[config.bodyColumn])
      .map((row, index) => buildComment(context, config, row, index)),
    events: [],
  };
}
