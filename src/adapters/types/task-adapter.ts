/**
 * Abstract interface for task management systems (GitHub, Asana, Linear, etc.)
 * This allows the plugin to be decoupled from any specific platform.
 */

export interface TaskComment {
  id: string | number;
  body: string;
  user: {
    id: string | number;
    login?: string; // GitHub-specific
    name?: string;
  };
  created_at: string;
  updated_at?: string;
  html_url?: string;
}

export interface TaskEvent {
  id: string | number;
  event: string;
  created_at: string;
  actor?: {
    id: string | number;
    login?: string;
    name?: string;
  };
}

export interface TaskAssignee {
  id: string | number;
  login?: string; // GitHub-specific
  name?: string;
  email?: string;
}

export interface Task {
  id: string | number;
  number?: number; // GitHub-specific (issue number)
  title: string;
  body: string | null;
  state: "open" | "closed" | "completed" | "in_progress" | string;
  state_reason?: string;
  assignees: TaskAssignee[];
  labels?: Array<{ id: string | number; name: string; color?: string }>;
  user: {
    id: string | number;
    login?: string;
    name?: string;
  };
  html_url: string;
  created_at: string;
  updated_at: string;
  pull_request?: {
    url: string;
    html_url: string;
  };
}

export interface LinkedPullRequest {
  url: string;
  html_url: string;
  number: number;
  title: string;
  state: string;
  merged: boolean;
  author: {
    id: string | number;
    login?: string;
    name?: string;
  };
}

export interface TaskAdapter {
  /**
   * Get the platform name
   */
  platform: string;

  /**
   * Get a task by its URL or identifier
   */
  getTask(taskRef: string): Promise<Task>;

  /**
   * Get comments on a task
   */
  getComments(taskRef: string): Promise<TaskComment[]>;

  /**
   * Get events/activity on a task
   */
  getEvents(taskRef: string): Promise<TaskEvent[]>;

  /**
   * Get linked pull requests (GitHub-specific, may return empty for other platforms)
   */
  getLinkedPullRequests?(taskRef: string): Promise<LinkedPullRequest[]>;

  /**
   * Get a single comment
   */
  getComment?(taskRef: string, commentId: string | number): Promise<TaskComment>;

  /**
   * Post a comment to a task
   */
  postComment?(taskRef: string, body: string): Promise<TaskComment>;

  /**
   * Update task state
   */
  updateTask?(taskRef: string, updates: Partial<Task>): Promise<Task>;

  /**
   * Check if a user has specific permissions
   */
  hasPermission?(taskRef: string, userId: string | number, permission: string): Promise<boolean>;
}

export type TaskAdapterConstructor = new (context: unknown) => TaskAdapter;
