import { CommentAssociation, CommentKind } from "../configuration/comment-types";

export type PayoutMode = "transfer" | "permit";
export interface PermitSaveError {
  message: string;
  nonce?: string;
  amount?: string;
  signature?: string;
  partnerId?: number;
  beneficiaryId?: number;
}
export interface Result {
  [k: string]: {
    comments?: GithubCommentScore[];
    total: number;
    task?: {
      reward: number;
      multiplier: number;
      timestamp: string;
      url: string;
      category?: "stale" | "standard";
    };
    feeRate?: number;
    permitUrl?: string;
    explorerUrl?: string;
    payoutMode?: PayoutMode;
    permitSaveErrors?: PermitSaveError[];
    userId: number;
    walletAddress?: string | null;
    /**
     * Sum of all permits previously distributed for this user on this issue.
     * Set during re-close cycles by _applyDifferentialRewards.
     * Undefined for first-time distributions (backward-compatible).
     */
    previousTotal?: number;
    /**
     * The incremental reward amount to distribute on this re-close cycle.
     * = total - previousTotal. Negative values mean the previous payout
     * was higher; positive means a new top-up is owed.
     * Undefined for first-time distributions (backward-compatible).
     */
    differentialAmount?: number;
    reviewRewards?: {
      reviews?: ReviewScore[];
      url: string;
    }[];
    simplificationReward?: {
      url: string;
      files: {
        fileName: string;
        reward: number;
        additions: number;
        deletions: number;
      }[];
    };
    events?: {
      [eventName: string]: {
        count: number;
        reward: number;
      };
    };
    evaluationCommentHtml?: string;
  };
}

export interface WordResult {
  wordCount: number;
  wordValue: number;
  result: number;
}

export interface ReadabilityScore {
  fleschKincaid: number;
  syllables: number;
  sentences: number;
  score: number;
}

export interface ReviewScore {
  priority: number;
  reviewId: number;
  effect: {
    addition: number;
    deletion: number;
  };
  reward: number;
}

export interface GithubCommentScore {
  id: number;
  content: string;
  url: string;
  timestamp: string;
  commentType: CommentKind | CommentAssociation;
  diffHunk?: string;
  score?: {
    formatting?: {
      content: Record<string, { score: number; elementCount: number }>;
      result: number;
    };
    words?: WordResult;
    readability?: ReadabilityScore;
    multiplier: number;
    relevance?: number;
    clarity?: number;
    priority?: number;
    reward: number;
    weight?: number;
    authorship: number;
  };
}
