import { ContextPlugin } from "../../types/plugin-input";
import { PlatformComment, PlatformTask, PlatformUser, TaskPlatformAdapter } from "./task-platform-adapter";

/**
 * GitHub implementation of the TaskPlatformAdapter wrapping Octokit.
 */
export class GitHubPlatformAdapter implements TaskPlatformAdapter {
  public readonly platformName = "github";

  constructor(private readonly _context: ContextPlugin) {}

  public async fetchTask(issueNumber: string | number): Promise<PlatformTask> {
    const { octokit, payload } = this._context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const { data: issue } = await octokit.rest.issues.get({
      owner,
      repo,
      issue_number: Number(issueNumber),
    });

    const author: PlatformUser = {
      id: issue.user?.id ?? 0,
      login: issue.user?.login ?? "ghost",
    };

    const assignees: PlatformUser[] = (issue.assignees ?? []).map((user) => ({
      id: user.id,
      login: user.login,
    }));

    const labels = (issue.labels ?? [])
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter(Boolean);

    return {
      id: issue.number,
      title: issue.title,
      body: issue.body ?? "",
      author,
      assignees,
      labels,
      state: issue.state === "closed" ? "closed" : "open",
      url: issue.html_url,
      completedAt: issue.closed_at ?? undefined,
    };
  }

  public async fetchComments(issueNumber: string | number): Promise<PlatformComment[]> {
    const { octokit, payload } = this._context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: Number(issueNumber),
      per_page: 100,
    });

    return comments.map((comment) => ({
      id: comment.id,
      author: {
        id: comment.user?.id ?? 0,
        login: comment.user?.login ?? "ghost",
      },
      body: comment.body ?? "",
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
    }));
  }

  public async postComment(issueNumber: string | number, body: string): Promise<PlatformComment> {
    const { octokit, payload } = this._context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    const { data: comment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: Number(issueNumber),
      body,
    });

    return {
      id: comment.id,
      author: {
        id: comment.user?.id ?? 0,
        login: comment.user?.login ?? "ghost",
      },
      body: comment.body ?? "",
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
    };
  }

  public async closeTask(issueNumber: string | number): Promise<void> {
    const { octokit, payload } = this._context;
    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;

    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: Number(issueNumber),
      state: "closed",
    });
  }
}
