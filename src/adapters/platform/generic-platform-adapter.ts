import { PlatformComment, PlatformTask, TaskPlatformAdapter } from "./task-platform-adapter";

export interface GenericAdapterConfig {
  platformName?: string;
  tasks?: Record<string | number, PlatformTask>;
  comments?: Record<string | number, PlatformComment[]>;
  onPostComment?: (taskId: string | number, body: string) => Promise<PlatformComment> | PlatformComment;
  onCloseTask?: (taskId: string | number) => Promise<void> | void;
}

/**
 * Generic decoupled platform adapter for external issue trackers
 * (Asana, Google Sheets rows, custom webhooks, or local memory).
 */
export class GenericTaskPlatformAdapter implements TaskPlatformAdapter {
  public readonly platformName: string;
  private readonly _tasks: Map<string, PlatformTask>;
  private readonly _comments: Map<string, PlatformComment[]>;
  private readonly _onPostComment?: (
    taskId: string | number,
    body: string
  ) => Promise<PlatformComment> | PlatformComment;
  private readonly _onCloseTask?: (taskId: string | number) => Promise<void> | void;

  constructor(config: GenericAdapterConfig = {}) {
    this.platformName = config.platformName ?? "generic";
    this._tasks = new Map();
    this._comments = new Map();
    this._onPostComment = config.onPostComment;
    this._onCloseTask = config.onCloseTask;

    if (config.tasks) {
      for (const [key, task] of Object.entries(config.tasks)) {
        this._tasks.set(String(key), task);
      }
    }
    if (config.comments) {
      for (const [key, comments] of Object.entries(config.comments)) {
        this._comments.set(String(key), [...comments]);
      }
    }
  }

  public async fetchTask(taskId: string | number): Promise<PlatformTask> {
    const id = String(taskId);
    const task = this._tasks.get(id);
    if (!task) {
      throw new Error(`Task with id '${id}' not found on platform '${this.platformName}'`);
    }
    return task;
  }

  public async fetchComments(taskId: string | number): Promise<PlatformComment[]> {
    const id = String(taskId);
    return this._comments.get(id) ?? [];
  }

  public async postComment(taskId: string | number, body: string): Promise<PlatformComment> {
    if (this._onPostComment) {
      return await this._onPostComment(taskId, body);
    }
    const id = String(taskId);
    const newComment: PlatformComment = {
      id: Date.now(),
      author: { id: 1, login: "system-rewards" },
      body,
      createdAt: new Date().toISOString(),
    };
    const list = this._comments.get(id) ?? [];
    list.push(newComment);
    this._comments.set(id, list);
    return newComment;
  }

  public async closeTask(taskId: string | number): Promise<void> {
    if (this._onCloseTask) {
      await this._onCloseTask(taskId);
      return;
    }
    const id = String(taskId);
    const task = this._tasks.get(id);
    if (task) {
      task.state = "closed";
      task.completedAt = new Date().toISOString();
    }
  }
}
