/**
 * Tests for the platform adapter layer (Issue #385 — GitHub Decoupling).
 *
 * These tests verify:
 *   1. The GitHubPlatformAdapter satisfies the PlatformActivity interface.
 *   2. Comment normalisation from GitHub types → PlatformComment.
 *   3. The LinearPlatformAdapter skeleton is structurally correct.
 *   4. All adapters implement the common PlatformActivity contract.
 */

import { GitHubPlatformAdapter } from "../src/adapters/platform/github-adapter";
import { LinearPlatformAdapter } from "../src/adapters/platform/linear-adapter";
import type { PlatformActivity, PlatformComment } from "../src/adapters/platform/types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function isPlatformActivity(obj: unknown): obj is PlatformActivity {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "platformId" in obj &&
    "init" in obj &&
    "getAllComments" in obj &&
    typeof (obj as PlatformActivity).init === "function" &&
    typeof (obj as PlatformActivity).getAllComments === "function"
  );
}

function isPlatformComment(obj: unknown): obj is PlatformComment {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "body" in obj &&
    "author" in obj &&
    "timestamp" in obj &&
    "url" in obj &&
    "authorRole" in obj &&
    "isReview" in obj
  );
}

// ---------------------------------------------------------------------------
// GitHubPlatformAdapter structural tests (no real GitHub API called)
// ---------------------------------------------------------------------------

describe("GitHubPlatformAdapter", () => {
  it("satisfies the PlatformActivity interface", () => {
    // Build a minimal mock context — no real Octokit required for structural tests.
    const mockContext = {
      config: { dataCollection: {} },
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      payload: { repository: { owner: { login: "test" }, name: "test-repo" } },
      octokit: {},
    } as never;

    const adapter = new GitHubPlatformAdapter(mockContext, {
      owner: "test",
      repo: "test-repo",
      issue_number: 1,
    });

    expect(isPlatformActivity(adapter)).toBe(true);
    expect(adapter.platformId).toBe("github");
    expect(adapter.specification).toBeNull(); // not yet initialised
  });

  it("exposes the underlying IssueActivity", () => {
    const mockContext = {
      config: { dataCollection: {} },
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      payload: { repository: { owner: { login: "test" }, name: "test-repo" } },
      octokit: {},
    } as never;

    const adapter = new GitHubPlatformAdapter(mockContext, {
      owner: "test",
      repo: "test-repo",
      issue_number: 1,
    });

    expect(adapter.issueActivity).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// LinearPlatformAdapter structural tests
// ---------------------------------------------------------------------------

describe("LinearPlatformAdapter", () => {
  const stubOptions = { apiKey: "lin_api_test", teamId: "ENG", issueId: "ENG-42" };

  it("satisfies the PlatformActivity interface", () => {
    const adapter = new LinearPlatformAdapter(stubOptions);
    expect(isPlatformActivity(adapter)).toBe(true);
    expect(adapter.platformId).toBe("linear");
  });

  it("returns empty comments before init", async () => {
    const adapter = new LinearPlatformAdapter(stubOptions);
    const comments = await adapter.getAllComments();
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBe(0);
  });

  it("initialises without throwing (stub)", async () => {
    const adapter = new LinearPlatformAdapter(stubOptions);
    await expect(adapter.init()).resolves.not.toThrow();
    expect(adapter.specification).toBeNull(); // stub returns null
  });
});

// ---------------------------------------------------------------------------
// PlatformComment shape tests
// ---------------------------------------------------------------------------

describe("PlatformComment type guard", () => {
  it("accepts a well-formed PlatformComment", () => {
    const comment: PlatformComment = {
      id: "1",
      body: "LGTM",
      author: "whilefoo",
      timestamp: "2024-01-01T00:00:00Z",
      url: "https://github.com/owner/repo/issues/1#issuecomment-1",
      authorRole: "contributor",
      isReview: false,
    };
    expect(isPlatformComment(comment)).toBe(true);
  });

  it("rejects a partial object", () => {
    const partial = { id: "1", body: "hi" };
    expect(isPlatformComment(partial)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-platform contract: all adapters must share common PlatformActivity shape
// ---------------------------------------------------------------------------

describe("PlatformActivity contract", () => {
  const adapters: Array<{ name: string; adapter: PlatformActivity }> = [
    {
      name: "GitHubPlatformAdapter",
      adapter: new GitHubPlatformAdapter(
        {
          config: { dataCollection: {} },
          logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
          payload: { repository: { owner: { login: "x" }, name: "y" } },
          octokit: {},
        } as never,
        { owner: "x", repo: "y", issue_number: 1 }
      ),
    },
    {
      name: "LinearPlatformAdapter",
      adapter: new LinearPlatformAdapter({ apiKey: "k", teamId: "T", issueId: "T-1" }),
    },
  ];

  for (const { name, adapter } of adapters) {
    describe(name, () => {
      it("has a non-empty platformId string", () => {
        expect(typeof adapter.platformId).toBe("string");
        expect(adapter.platformId.length).toBeGreaterThan(0);
      });

      it("has an async init method", () => {
        expect(typeof adapter.init).toBe("function");
      });

      it("has an async getAllComments method returning an array", async () => {
        expect(typeof adapter.getAllComments).toBe("function");
        const result = await adapter.getAllComments();
        expect(Array.isArray(result)).toBe(true);
      });
    });
  }
});
