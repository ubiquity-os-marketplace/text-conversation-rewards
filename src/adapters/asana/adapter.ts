import { Task, TaskAdapter, TaskComment, TaskEvent, LinkedPullRequest } from "../types/task-adapter";

/**
 * Asana API adapter for task management decoupling
 *
 * This adapter allows the plugin to work with Asana instead of GitHub,
 * enabling the reward system to work across different task management platforms.
 */
export class AsanaAdapter implements TaskAdapter {
  platform = "asana";
  private _accessToken: string;
  private _workspaceGid: string;
  private _projectGid?: string;

  constructor(config: { accessToken: string; workspaceGid: string; projectGid?: string }) {
    this._accessToken = config.accessToken;
    this._workspaceGid = config.workspaceGid;
    this._projectGid = config.projectGid;
  }

  private async _asanaRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`https://app.asana.com/api/1.0${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this._accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Asana API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data: T };
    return data.data;
  }

  async getTask(taskRef: string): Promise<Task> {
    // taskRef can be either a task GID or a full Asana URL
    const taskGid = this._extractAsanaGid(taskRef);

    const task = await this._asanaRequest<{
      gid: string;
      name: string;
      notes: string;
      completed: boolean;
      assignee?: { gid: string; name: string };
      memberships: Array<{ section?: { gid: string; name: string }; project?: { gid: string; name: string } }>;
      created_at: string;
      modified_at: string;
      permalink_url: string;
      custom_fields?: Array<{ gid: string; name: string; display_value: string }>;
    }>(
      `/tasks/${taskGid}?opt_fields=name,notes,completed,assignee,memberships,created_at,modified_at,permalink_url,custom_fields`
    );

    // Get project info from memberships (for potential future use)
    // const projectMembership = task.memberships?.find((m) => m.project);
    // const projectName = projectMembership?.project?.name ?? "Unknown Project";

    return {
      id: task.gid,
      number: undefined, // Asana doesn't have issue numbers like GitHub
      title: task.name,
      body: task.notes,
      state: task.completed ? "completed" : "open",
      assignees: task.assignee ? [{ id: task.assignee.gid, name: task.assignee.name }] : [],
      user: { id: "system", name: "System" }, // Asana doesn't have a single "creator" context
      html_url: task.permalink_url,
      created_at: task.created_at,
      updated_at: task.modified_at,
    };
  }

  async getComments(taskRef: string): Promise<TaskComment[]> {
    const taskGid = this._extractAsanaGid(taskRef);

    const stories = await this._asanaRequest<
      Array<{
        gid: string;
        created_at: string;
        created_by: { gid: string; name: string };
        type: string;
        text?: string;
        subtype?: string;
      }>
    >(`/tasks/${taskGid}/stories?opt_fields=gid,created_at,created_by,type,text,subtype&limit=100`);

    // Filter to only actual comments (stories with text content)
    return stories
      .filter((s) => s.type === "comment" && s.text)
      .map((s) => ({
        id: s.gid,
        body: s.text ?? "",
        user: {
          id: s.created_by.gid,
          name: s.created_by.name,
        },
        created_at: s.created_at,
        updated_at: s.created_at,
        html_url: `https://app.asana.com/0/0/${s.gid}`, // Asana stories don't have permalinks
      }));
  }

  async getEvents(taskRef: string): Promise<TaskEvent[]> {
    const taskGid = this._extractAsanaGid(taskRef);

    const stories = await this._asanaRequest<
      Array<{
        gid: string;
        created_at: string;
        created_by: { gid: string; name: string };
        type: string;
        action: string;
        resource_subtype?: string;
      }>
    >(`/tasks/${taskGid}/stories?opt_fields=gid,created_at,created_by,type,action,resource_subtype&limit=100`);

    return stories.map((s) => ({
      id: s.gid,
      event: `${s.action}:${s.resource_subtype ?? s.type}`,
      created_at: s.created_at,
      actor: {
        id: s.created_by.gid,
        name: s.created_by.name,
      },
    }));
  }

  async getLinkedPullRequests(_taskRef: string): Promise<LinkedPullRequest[]> {
    // Asana doesn't have native pull request linking
    // Could implement custom field-based linking if needed
    return [];
  }

  async postComment(taskRef: string, body: string): Promise<TaskComment> {
    const taskGid = this._extractAsanaGid(taskRef);

    const story = await this._asanaRequest<{
      gid: string;
      created_at: string;
      created_by: { gid: string; name: string };
      text: string;
    }>(`/tasks/${taskGid}/stories`, {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "comment",
          text: body,
        },
      }),
    });

    return {
      id: story.gid,
      body: story.text,
      user: {
        id: story.created_by.gid,
        name: story.created_by.name,
      },
      created_at: story.created_at,
      updated_at: story.created_at,
    };
  }

  async updateTask(taskRef: string, updates: Partial<Task>): Promise<Task> {
    const taskGid = this._extractAsanaGid(taskRef);

    const updateData: Record<string, unknown> = {};
    if (updates.title) updateData.name = updates.title;
    if (updates.body !== undefined) updateData.notes = updates.body;
    if (updates.state === "completed") updateData.completed = true;
    else if (updates.state === "open") updateData.completed = false;

    await this._asanaRequest(`/tasks/${taskGid}`, {
      method: "PUT",
      body: JSON.stringify({ data: updateData }),
    });

    return this.getTask(taskRef);
  }

  async hasPermission(_taskRef: string, _userId: string | number, _permission: string): Promise<boolean> {
    // Asana permission checking would need to be implemented based on workspace/project permissions
    return true;
  }

  /**
   * Extract Asana GID from URL or return as-is if already a GID
   */
  private _extractAsanaGid(ref: string): string {
    // If it's a URL, extract the GID from the path
    if (ref.includes("app.asana.com")) {
      const match = ref.match(/\/(\d+)(?:\?|$)/);
      if (match) return match[1];
    }
    // Assume it's already a GID
    return ref;
  }

  /**
   * Create a new task in Asana
   */
  static async createTask(
    config: { accessToken: string; workspaceGid: string; projectGid?: string },
    params: { name: string; notes?: string; completed?: boolean; assignee?: string }
  ): Promise<Task> {
    const adapter = new AsanaAdapter(config);

    const task = await adapter._asanaRequest<{
      gid: string;
      name: string;
      notes: string;
      completed: boolean;
      created_at: string;
      modified_at: string;
      permalink_url: string;
    }>("/tasks", {
      method: "POST",
      body: JSON.stringify({
        data: {
          name: params.name,
          notes: params.notes,
          completed: params.completed ?? false,
          ...(params.assignee ? { assignee: params.assignee } : {}),
          ...(config.projectGid ? { projects: [config.projectGid] } : {}),
        },
      }),
    });

    return {
      id: task.gid,
      title: task.name,
      body: task.notes,
      state: task.completed ? "completed" : "open",
      assignees: [],
      user: { id: "system", name: "System" },
      html_url: task.permalink_url,
      created_at: task.created_at,
      updated_at: task.modified_at,
    };
  }
}
