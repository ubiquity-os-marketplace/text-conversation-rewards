/**
 * Unit tests for DataPurgeModule.creditResearchOnUnplanned — Issue #296
 *
 * Feature: when an issue is closed as "not_planned" and the new Boolean option
 * `creditResearchOnUnplanned` is true, the current assignee's comments during
 * their assignment period should NOT be skipped — they deserve comment credits
 * for the research they did, even if the task turned out to be infeasible.
 */

import { describe, expect, it } from "@jest/globals";
import { CommentKind } from "../src/configuration/comment-types";
import { DataPurgeModule } from "../src/parser/data-purge-module";
import { ContextPlugin } from "../src/types/plugin-input";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const ASSIGNED_AT = "2024-06-01T00:00:00Z";
const DURING_ASSIGNMENT = "2024-06-15T12:00:00Z"; // clearly within assignment period

function makeComment(login: string, createdAt = DURING_ASSIGNMENT) {
  return {
    id: 1,
    body: "I researched this and found it is infeasible because of X and Y.",
    user: { login, type: "User" },
    created_at: createdAt,
    html_url: `https://github.com/test/repo/issues/1#issuecomment-${login}`,
    commentType: CommentKind.ISSUE,
    isMinimized: false,
  };
}

function makeContext(stateReason: string, creditResearchOnUnplanned: boolean, assigneeLogin = "assignee") {
  return {
    payload: {
      issue: {
        state_reason: stateReason,
        assignees: [{ login: assigneeLogin }],
      },
    },
    config: {
      incentives: {
        dataPurge: {
          skipCommentsWhileAssigned: "all",
          creditResearchOnUnplanned,
        },
      },
    },
    logger: {
      debug: () => undefined,
      warn: () => undefined,
      info: () => undefined,
      error: () => undefined,
    },
  } as unknown as ContextPlugin;
}

function makeModule(ctx: ContextPlugin, assigneeLogin = "assignee") {
  const m = new DataPurgeModule(ctx);
  // Simulate that the assignee has an active (open) assignment period
  m._assignmentPeriods = {
    [assigneeLogin]: [{ assignedAt: ASSIGNED_AT, unassignedAt: null }],
  };
  return m;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests — creditResearchOnUnplanned
// ──────────────────────────────────────────────────────────────────────────────
describe("DataPurgeModule.creditResearchOnUnplanned — Issue #296", () => {
  it("skips assignee comment (not_planned, but creditResearchOnUnplanned=false)", async () => {
    const m = makeModule(makeContext("not_planned", false));
    const comment = makeComment("assignee");
    expect(await m._shouldSkipComment(comment as never)).toBe(true);
  });

  it("credits assignee comment (not_planned + creditResearchOnUnplanned=true)", async () => {
    const m = makeModule(makeContext("not_planned", true));
    const comment = makeComment("assignee");
    // New behaviour: research comments should NOT be skipped
    expect(await m._shouldSkipComment(comment as never)).toBe(false);
  });

  it("skips assignee comment on normal completion even when creditResearchOnUnplanned=true", async () => {
    const m = makeModule(makeContext("completed", true));
    const comment = makeComment("assignee");
    // Regular task completion → normal skip behaviour preserved
    expect(await m._shouldSkipComment(comment as never)).toBe(true);
  });

  it("never skips unassigned non-assignee comments (no assignment period)", async () => {
    const m = makeModule(makeContext("not_planned", false));
    const comment = makeComment("other-contributor"); // has no assignment period
    expect(await m._shouldSkipComment(comment as never)).toBe(false);
  });
});
