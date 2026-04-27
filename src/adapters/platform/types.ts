/**
 * Platform-agnostic adapter interfaces for text-conversation-rewards.
 *
 * These types define the normalized data contract that platform adapters must
 * satisfy. By depending only on these abstractions (rather than on GitHub
 * REST/GraphQL types) the reward-evaluator pipeline becomes portable to any
 * project-management platform — Asana, Linear, Google Drive, Notion, etc.
 *
 * @see Issue #385 — GitHub Decoupling
 */

/**
 * A single contribution entry scoped to one author in the normalized model.
 * Adapters map platform-native "comment", "edit", or "review" objects to this shape.
 */
export interface PlatformComment {
  /** Platform-native comment/item identifier (string for cross-platform compat). */
  id: string;
  /** Raw text body of the contribution (markdown or plain text). */
  body: string;
  /** Platform username or email of the contributor. */
  author: string;
  /** ISO-8601 timestamp when the contribution was created. */
  timestamp: string;
  /**
   * Canonical URL pointing to the comment on its originating platform.
   * Used for audit links in reward output and logging.
   */
  url: string;
  /**
   * Platform-native role of the author relative to the task.
   * "specification" = task description author, "assignee", "collaborator", "contributor".
   * Adapters should map platform-specific roles to these generic values.
   */
  authorRole: "specification" | "assignee" | "collaborator" | "contributor";
  /**
   * Whether this comment originates from a review/code-review context
   * (e.g. pull-request review on GitHub, inline comment on a Google Doc).
   */
  isReview: boolean;
}

/**
 * The normalized task representation consumed by the reward pipeline.
 *
 * Platform adapters (GitHub, Linear, Google Sheets, Asana…) implement
 * this interface so that evaluator modules remain platform-agnostic.
 */
export interface PlatformActivity {
  /** Human-readable platform identifier, e.g. "github", "linear", "asana". */
  readonly platformId: string;

  /** The task's specification body (issue description, card notes, doc body…). */
  specification: string | null;

  /**
   * Asynchronously initialises the activity by fetching data from the
   * remote platform. Must be called before accessing `specification` or
   * `getAllComments()`.
   */
  init(): Promise<void>;

  /**
   * Returns a flat, chronologically ordered list of all contributions
   * associated with the task — including specification, comments, reviews.
   *
   * Adapters are responsible for de-duplicating entries and sorting by
   * `timestamp` ascending.
   */
  getAllComments(): Promise<PlatformComment[]>;
}

/**
 * Minimal identity data that adapters must surface per contributor.
 * Used by the payment module to look up wallet addresses.
 */
export interface PlatformContributor {
  /** Platform-unique handle (login, email, etc.) */
  username: string;
  /**
   * Optional displayable name. Falls back to `username` when absent.
   */
  displayName?: string;
}

/**
 * Factory function type. Implementations should inspect `platformId` and
 * return the matching adapter, or throw when the platform is unsupported.
 *
 * @example
 * ```ts
 * const adapter = platformAdapterFactory("github", context, issueParams);
 * await adapter.init();
 * const comments = await adapter.getAllComments();
 * ```
 */
export type PlatformAdapterFactory<TContext = unknown, TParams = unknown> = (
  platformId: string,
  context: TContext,
  params: TParams
) => PlatformActivity;
