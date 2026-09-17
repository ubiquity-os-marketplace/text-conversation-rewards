/**
 * Abstract task platform interface for decoupling conversation rewards
 * from GitHub-specific APIs (e.g. Asana, Google Sheets, custom REST endpoints).
 * Resolves Issue #385: GitHub Decoupling.
 */

export interface PlatformUser {
  id: string | number;
  login: string;
  name?: string;
  email?: string;
}

export interface PlatformComment {
  id: string | number;
  author: PlatformUser;
  body: string;
  createdAt: string;
  updatedAt?: string;
  url?: string;
}

export interface PlatformTask {
  id: string | number;
  title: string;
  body: string;
  author: PlatformUser;
  assignees: PlatformUser[];
  labels: string[];
  state: "open" | "closed";
  url?: string;
  completedAt?: string;
}

export interface TaskPlatformAdapter {
  platformName: string;
  fetchTask(taskId: string | number): Promise<PlatformTask>;
  fetchComments(taskId: string | number): Promise<PlatformComment[]>;
  postComment(taskId: string | number, body: string): Promise<PlatformComment>;
  closeTask?(taskId: string | number): Promise<void>;
}
