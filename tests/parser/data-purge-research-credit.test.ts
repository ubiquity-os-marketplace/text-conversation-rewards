import { describe, expect, it } from "@jest/globals";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { CommentKind } from "../../src/configuration/comment-types";
import { DataPurgeModule } from "../../src/parser/data-purge-module";
import { ContextPlugin } from "../../src/types/plugin-input";

function createModule() {
  const context = {
    config: {
      incentives: {
        dataPurge: {
          skipCommentsWhileAssigned: "all",
        },
      },
    },
    payload: {
      issue: {
        html_url: "https://github.com/ubiquity-os/conversation-rewards/issues/1",
        assignees: [{ login: "current-assignee" }],
      },
      repository: {
        owner: { login: "ubiquity-os" },
        name: "conversation-rewards",
      },
    },
    logger: new Logs("debug"),
  } as unknown as ContextPlugin;

  const module = new DataPurgeModule(context);
  Reflect.set(module, "_assignmentPeriods", {
    "previous-assignee": [{ assignedAt: "2025-03-01T00:00:00Z", unassignedAt: "2025-03-02T00:00:00Z" }],
    "current-assignee": [{ assignedAt: "2025-03-01T00:00:00Z", unassignedAt: "2025-03-03T00:00:00Z" }],
  });
  Reflect.set(module, "_currentAssigneeLogins", new Set(["current-assignee"]));
  return module;
}

function createAssignedComment(login: string, commentType: CommentKind) {
  return {
    body: "I researched the constraints and found a useful implementation path.",
    commentType,
    created_at: "2025-03-01T12:00:00Z",
    html_url: `https://github.com/ubiquity-os/conversation-rewards/issues/1#${login}`,
    user: { login },
  } as never;
}

describe("DataPurgeModule research credit", () => {
  it("keeps previous assignee issue comments but still skips current assignee and pull comments", async () => {
    const module = createModule();

    await expect(
      module._shouldSkipComment(createAssignedComment("previous-assignee", CommentKind.ISSUE))
    ).resolves.toBe(false);
    await expect(module._shouldSkipComment(createAssignedComment("current-assignee", CommentKind.ISSUE))).resolves.toBe(
      true
    );
    await expect(module._shouldSkipComment(createAssignedComment("previous-assignee", CommentKind.PULL))).resolves.toBe(
      true
    );
  });
});
