import { describe, expect, it, jest } from "@jest/globals";
import { CommentAssociation, CommentKind } from "../../src/configuration/comment-types";
import { DataPurgeModule } from "../../src/parser/data-purge-module";
import { ContextPlugin } from "../../src/types/plugin-input";

function createModule() {
  const module = new DataPurgeModule({
    config: {
      incentives: {
        dataPurge: {
          skipCommentsWhileAssigned: "all",
        },
      },
    },
    logger: {
      debug: jest.fn(),
      warn: jest.fn(),
    },
    payload: {
      issue: {
        html_url: "https://github.com/owner/repo/issues/1",
        assignees: [{ login: "current-assignee" }],
      },
    },
  } as unknown as ContextPlugin);

  module._assignmentPeriods = {
    "previous-assignee": [
      {
        assignedAt: "2026-01-01T00:00:00.000Z",
        unassignedAt: "2026-01-03T00:00:00.000Z",
      },
    ],
    "current-assignee": [
      {
        assignedAt: "2026-01-01T00:00:00.000Z",
        unassignedAt: null,
      },
    ],
  };

  return module;
}

function createComment(login: string, commentType: CommentKind | CommentAssociation, id = 1) {
  return {
    id,
    body: "Research notes with useful implementation context.",
    created_at: "2026-01-02T00:00:00.000Z",
    html_url: "https://github.com/owner/repo/issues/1#issuecomment-1",
    user: {
      id,
      login,
      type: "User",
    },
    commentType,
  } as Parameters<DataPurgeModule["_shouldSkipComment"]>[0];
}

describe("DataPurgeModule", () => {
  it("keeps issue research from previous assignees without crediting current assignees or pull-request work", async () => {
    const module = createModule();

    await expect(
      module._shouldSkipComment(createComment("previous-assignee", CommentKind.ISSUE | CommentAssociation.ASSIGNEE))
    ).resolves.toBe(false);
    await expect(
      module._shouldSkipComment(createComment("current-assignee", CommentKind.ISSUE | CommentAssociation.ASSIGNEE, 2))
    ).resolves.toBe(true);
    await expect(
      module._shouldSkipComment(createComment("previous-assignee", CommentKind.PULL | CommentAssociation.ASSIGNEE, 3))
    ).resolves.toBe(true);
  });
});
