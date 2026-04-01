import { ContextPlugin } from "../../types/plugin-input";
import { Task, TaskAdapter, TaskComment, TaskEvent, LinkedPullRequest } from "../types/task-adapter";
import { parseGitHubUrl, getIssue, getIssueComments, getIssueEvents } from "../../start";
import { collectLinkedPulls } from "../../data-collection/collect-linked-pulls";

export class GitHubAdapter implements TaskAdapter {
  platform = "github";
  private _context: ContextPlugin;

  constructor(context: ContextPlugin) {
    this._context = context;
  }

  async getTask(taskRef: string): Promise<Task> {
    const params = parseGitHubUrl(taskRef);
    const issue = await getIssue(this._context, params);

    // Handle labels - they can be various formats in GitHub API
    const labels =
      issue.labels?.map((label) => {
        if (typeof label === "string") {
          return { id: label, name: label, color: undefined };
        }
        return {
          id: (label as { id?: number | string }).id ?? label,
          name: (label as { name?: string }).name ?? "",
          color: (label as { color?: string }).color,
        };
      }) ?? [];

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state,
      state_reason: issue.state_reason ?? undefined,
      assignees: (issue.assignees ?? []).map((a) => ({
        id: a.id,
        login: a.login,
        name: (a as { name?: string }).name ?? undefined,
      })),
      labels: labels as Array<{ id: string | number; name: string; color?: string }>,
      user: {
        id: issue.user?.id ?? 0,
        login: issue.user?.login,
        name: (issue.user as { name?: string })?.name ?? undefined,
      },
      html_url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      pull_request: issue.pull_request
        ? {
            url: issue.pull_request.url ?? "",
            html_url: issue.pull_request.html_url ?? "",
          }
        : undefined,
    };
  }

  async getComments(taskRef: string): Promise<TaskComment[]> {
    const params = parseGitHubUrl(taskRef);
    const comments = await getIssueComments(this._context, params);

    return comments.map((c) => ({
      id: c.id,
      body: c.body ?? "",
      user: {
        id: c.user?.id ?? 0,
        login: c.user?.login,
      },
      created_at: c.created_at,
      updated_at: c.updated_at,
      html_url: c.html_url,
    }));
  }

  async getEvents(taskRef: string): Promise<TaskEvent[]> {
    const params = parseGitHubUrl(taskRef);
    const events = await getIssueEvents(this._context, params);

    return events.map((e) => ({
      id: e.id,
      event: e.event,
      created_at: e.created_at,
      actor: e.actor
        ? {
            id: e.actor.id,
            login: e.actor.login,
          }
        : undefined,
    }));
  }

  async getLinkedPullRequests(taskRef: string): Promise<LinkedPullRequest[]> {
    const params = parseGitHubUrl(taskRef);
    const linkedPulls = await collectLinkedPulls(this._context, params);

    return linkedPulls.map((pull) => ({
      url: pull.url ?? "",
      html_url: pull.url ?? "",
      number: pull.number ?? 0,
      title: pull.title ?? "",
      state: pull.state ?? "",
      merged: (pull as unknown as { merged?: boolean }).merged ?? false,
      author: {
        id: pull.author?.id ?? 0,
        login: pull.author?.login,
      },
    }));
  }

  async postComment(taskRef: string, body: string): Promise<TaskComment> {
    const params = parseGitHubUrl(taskRef);
    const { octokit } = this._context;

    const { data } = await octokit.rest.issues.createComment({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issue_number,
      body,
    });

    return {
      id: data.id,
      body: data.body ?? "",
      user: {
        id: data.user?.id ?? 0,
        login: data.user?.login,
      },
      created_at: data.created_at,
      updated_at: data.updated_at,
      html_url: data.html_url,
    };
  }

  async updateTask(taskRef: string, updates: Partial<Task>): Promise<Task> {
    const params = parseGitHubUrl(taskRef);
    const { octokit } = this._context;

    const updatePayload: Record<string, unknown> = {};
    if (updates.state) {
      updatePayload.state = updates.state === "closed" ? "closed" : "open";
    }

    await octokit.rest.issues.update({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issue_number,
      ...updatePayload,
    });

    return this.getTask(taskRef);
  }

  async hasPermission(_taskRef: string, _userId: string | number, _permission: string): Promise<boolean> {
    // For GitHub, permission checks would need to be implemented based on the specific permission
    // This is a placeholder implementation
    return true;
  }
}
