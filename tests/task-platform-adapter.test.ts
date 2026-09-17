import { GenericTaskPlatformAdapter, PlatformComment, PlatformTask } from "../src/adapters/platform";

describe("TaskPlatformAdapter (GitHub Decoupling - Issue #385)", () => {
  it("should initialize generic platform adapter with initial task and comments", async () => {
    const mockTask: PlatformTask = {
      id: "TASK-42",
      title: "Implement external sheets integration",
      body: "Decouple plugin from octokit",
      author: { id: 101, login: "alice" },
      assignees: [{ id: 102, login: "bob" }],
      labels: ["Priority: 1", "Price: 1200 USD"],
      state: "open",
    };

    const mockComments: PlatformComment[] = [
      {
        id: 1,
        author: { id: 102, login: "bob" },
        body: "I started working on the decoupled sheets adapter",
        createdAt: "2026-09-17T10:00:00Z",
      },
    ];

    const adapter = new GenericTaskPlatformAdapter({
      platformName: "google-sheets",
      tasks: { "TASK-42": mockTask },
      comments: { "TASK-42": mockComments },
    });

    expect(adapter.platformName).toBe("google-sheets");

    const fetchedTask = await adapter.fetchTask("TASK-42");
    expect(fetchedTask.title).toBe("Implement external sheets integration");
    expect(fetchedTask.assignees[0].login).toBe("bob");

    const fetchedComments = await adapter.fetchComments("TASK-42");
    expect(fetchedComments.length).toBe(1);
    expect(fetchedComments[0].body).toContain("decoupled sheets adapter");
  });

  it("should post comment and close task on generic platform", async () => {
    const mockTask: PlatformTask = {
      id: 99,
      title: "Asana Task",
      body: "Sample task",
      author: { id: 1, login: "manager" },
      assignees: [],
      labels: [],
      state: "open",
    };

    const adapter = new GenericTaskPlatformAdapter({
      platformName: "asana",
      tasks: { 99: mockTask },
    });

    const comment = await adapter.postComment(99, "Reward of $1200 generated!");
    expect(comment.body).toBe("Reward of $1200 generated!");

    const comments = await adapter.fetchComments(99);
    expect(comments.length).toBe(1);

    await adapter.closeTask(99);
    const updated = await adapter.fetchTask(99);
    expect(updated.state).toBe("closed");
    expect(updated.completedAt).toBeDefined();
  });

  it("should throw error when task is not found", async () => {
    const adapter = new GenericTaskPlatformAdapter({ platformName: "sheets" });
    await expect(adapter.fetchTask("UNKNOWN-ID")).rejects.toThrow(
      "Task with id 'UNKNOWN-ID' not found on platform 'sheets'"
    );
  });
});
