import { CommentAssociation, CommentKind } from "../configuration/comment-types";

export interface Result {
  [k: string]: {
    comments?: GithubCommentScore[];
    total: number;
    task?: {
      reward: number;
      multiplier: number;
    };
    feeRate?: number;
    permitUrl?: string;
    userId: number;
    reviewRewards?: {
      reviews?: ReviewScore[];
      reviewBaseReward?: { reward: number };
      url: string;
    }[];
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
  type: CommentKind | CommentAssociation;
  diffHunk?: string;
  score?: {
    formatting?: {
      content: Record<string, { score: number; elementCount: number }>;
      result: number;
    };
    words?: WordResult;
    multiplier: number;
    relevance?: number;
    clarity?: number;
    priority?: number;
    reward: number;
  };
}
