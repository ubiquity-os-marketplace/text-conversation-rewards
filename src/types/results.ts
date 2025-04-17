import { CommentAssociation, CommentKind } from "../configuration/comment-types";

export type PayoutMode = "transfer" | "permit";
export interface Result {
  [k: string]: {
    comments?: GithubCommentScore[];
    total: number;
    task?: {
      reward: number;
      multiplier: number;
      timestamp: string;
      url: string;
    };
    feeRate?: number;
    permitUrl?: string;
    explorerUrl?: string;
    payoutMode?: PayoutMode;
    userId: number;
    walletAddress?: string | null;
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
  };
}
