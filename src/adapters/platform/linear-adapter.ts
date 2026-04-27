/**
 * Linear platform adapter — stub implementation of PlatformActivity.
 *
 * Linear (https://linear.app) is a popular issue-tracking and project-management
 * tool with an excellent REST + GraphQL API (@linear/sdk).
 *
 * This file serves as a concrete proof-of-concept that the PlatformActivity
 * abstraction introduced in Issue #385 works for a second platform and shows
 * the exact shape an implementer must fill in.
 *
 * To activate this adapter in production:
 *   1. Install the official SDK: `npm install @linear/sdk`
 *   2. Set the environment variable `LINEAR_API_KEY`
 *   3. Fill in the TODO sections below.
 *   4. Wire the adapter via the factory (see `index.ts`).
 *
 * @see https://developers.linear.app/docs/sdk/getting-started
 * @see Issue #385 — GitHub Decoupling
 */

import type { PlatformActivity, PlatformComment } from "./types";

/** Minimal Linear issue shape (mirrors the Linear SDK's Issue type). */
interface LinearIssue {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  url: string;
  creator?: { displayName: string } | null;
  assignee?: { displayName: string } | null;
}

/** Minimal Linear comment shape. */
interface LinearComment {
  id: string;
  body: string;
  createdAt: string;
  url: string;
  user?: { displayName: string } | null;
}

export interface LinearAdapterOptions {
  /** Linear API personal access token or OAuth token. */
  apiKey: string;
  /** Linear workspace team ID (slug or UUID). */
  teamId: string;
  /** Linear issue ID to evaluate (e.g. "ENG-123" or UUID). */
  issueId: string;
}

/**
 * Stub adapter that demonstrates the PlatformActivity contract for Linear.
 *
 * Replace each `TODO` comment with a real Linear SDK call to make this fully
 * operational. The adapter intentionally avoids production imports so the
 * codebase compiles without adding `@linear/sdk` as a dependency until the
 * feature is gated by configuration.
 */
export class LinearPlatformAdapter implements PlatformActivity {
  readonly platformId = "linear";

  specification: string | null = null;

  private _issue: LinearIssue | null = null;
  private _comments: LinearComment[] = [];

  constructor(private readonly _options: LinearAdapterOptions) {}

  async init(): Promise<void> {
    /*
     * TODO: Replace stub with actual Linear SDK calls.
     *
     * Example (requires `@linear/sdk`):
     *
     *   import { LinearClient } from "@linear/sdk";
     *   const client = new LinearClient({ apiKey: this._options.apiKey });
     *   this._issue = await client.issue(this._options.issueId);
     *   const commentsPage = await this._issue.comments();
     *   this._comments = commentsPage.nodes;
     *   this.specification = this._issue.description ?? null;
     */
    console.info(
      `[LinearPlatformAdapter] init() — stub. Would fetch issue ${this._options.issueId} from team ${this._options.teamId}.`
    );
    this.specification = null;
  }

  async getAllComments(): Promise<PlatformComment[]> {
    if (!this._issue) {
      return [];
    }

    const comments: PlatformComment[] = [];

    // Map the issue description to the specification comment.
    if (this._issue.description) {
      comments.push({
        id: `${this._issue.id}:description`,
        body: this._issue.description,
        author: this._issue.creator?.displayName ?? "unknown",
        timestamp: this._issue.createdAt,
        url: this._issue.url,
        authorRole: "specification",
        isReview: false,
      });
    }

    // Map Linear comments to PlatformComment.
    for (const comment of this._comments) {
      const isAssignee =
        this._issue.assignee?.displayName === comment.user?.displayName;

      comments.push({
        id: comment.id,
        body: comment.body,
        author: comment.user?.displayName ?? "unknown",
        timestamp: comment.createdAt,
        url: comment.url,
        authorRole: isAssignee ? "assignee" : "contributor",
        isReview: false,
      });
    }

    return comments.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
}
