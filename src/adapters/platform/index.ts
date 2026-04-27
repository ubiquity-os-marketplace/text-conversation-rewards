/**
 * Platform adapter layer — public API.
 *
 * This module exports the PlatformActivity abstraction and all bundled adapter
 * implementations. Import from here rather than from the individual adapter
 * files to shield callers from internal restructuring.
 *
 * @see Issue #385 — GitHub Decoupling
 */

export type { PlatformActivity, PlatformComment, PlatformContributor, PlatformAdapterFactory } from "./types";
export { GitHubPlatformAdapter } from "./github-adapter";
export { LinearPlatformAdapter } from "./linear-adapter";
export type { LinearAdapterOptions } from "./linear-adapter";
