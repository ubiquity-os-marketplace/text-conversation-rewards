import { CommentAssociation, CommentKind } from "../configuration/comment-types";
import { GithubCommentScore, Result } from "../types/results";

export type PlatformContributionKind = "specification" | "comment" | "revision" | "deliverable";

export interface PlatformContributor {
  /** Stable platform-local identity such as a GitHub login, Google account id, or Notion user id. */
  id: string;
  /** Human-readable display name. Falls back to id in normalized output keys. */
  displayName?: string;
  /** Optional numeric id for GitHub-compatible downstream payment modules. */
  githubUserId?: number;
  /** Optional payout/account identifier emitted for non-GitHub adapters. */
  walletAddress?: string | null;
}

export interface PlatformContribution {
  id: string | number;
  authorId: string;
  body: string;
  url?: string;
  timestamp?: string;
  kind?: PlatformContributionKind;
  authorship?: number;
}

export interface PlatformContributionInput {
  platform: string;
  specification: string;
  contributors: PlatformContributor[];
  contributions: PlatformContribution[];
}

export interface NormalizedPlatformContribution extends GithubCommentScore {
  platform: string;
  sourceContributionId: string;
  sourceKind: PlatformContributionKind;
}

function normalizeContributorKey(contributor: PlatformContributor) {
  return contributor.displayName?.trim() || contributor.id;
}

function normalizeAuthorship(authorship: number | undefined) {
  if (authorship === undefined || Number.isNaN(authorship)) {
    return 1;
  }
  return Math.min(1, Math.max(0, authorship));
}

function toStableNumericId(value: string | number) {
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return value;
  }
  const text = String(value);
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function toCommentType(kind: PlatformContributionKind) {
  const base = CommentKind.ISSUE;
  const association = kind === "specification" ? CommentAssociation.SPECIFICATION : CommentAssociation.CONTRIBUTOR;
  return base | association;
}

/**
 * Converts platform-adapter output into the existing reward Result shape.
 *
 * This keeps the scoring pipeline portable: Google Docs, Sheets, Notion,
 * Asana, or other adapters can emit a specification plus normalized author
 * contributions without pretending that every source is a GitHub issue thread.
 */
export function normalizePlatformContributions(input: PlatformContributionInput): Result {
  const contributors = new Map(input.contributors.map((contributor) => [contributor.id, contributor]));
  const result: Result = {};

  for (const contribution of input.contributions) {
    const contributor = contributors.get(contribution.authorId) ?? { id: contribution.authorId };
    const username = normalizeContributorKey(contributor);
    const kind = contribution.kind ?? "comment";
    const normalized: NormalizedPlatformContribution = {
      id: toStableNumericId(contribution.id),
      sourceContributionId: String(contribution.id),
      platform: input.platform,
      sourceKind: kind,
      content: contribution.body,
      url: contribution.url ?? `${input.platform}:${contribution.id}`,
      timestamp: contribution.timestamp ?? new Date(0).toISOString(),
      commentType: toCommentType(kind),
      score: {
        multiplier: 1,
        reward: 0,
        authorship: normalizeAuthorship(contribution.authorship),
      },
    };

    result[username] ??= {
      total: 0,
      userId: contributor.githubUserId ?? toStableNumericId(contributor.id),
      walletAddress: contributor.walletAddress,
      comments: [],
    };
    result[username].comments?.push(normalized);
  }

  return result;
}

export function buildPlatformSpecification(input: PlatformContributionInput) {
  return {
    body: input.specification,
    platform: input.platform,
  };
}
