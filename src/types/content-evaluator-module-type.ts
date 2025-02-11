import { Type, Static } from "@sinclair/typebox";

export type CommentToEvaluate = { id: number; comment: string };

export type PrCommentToEvaluate = { id: number; comment: string; diffHunk?: string };

export type AllComments = { id: number; comment: string; author: string }[];

export const openAiRelevanceResponseSchema = Type.Record(
  Type.RegExp("^[0-9]+$"),
  Type.Number({ minimum: 0, maximum: 1 })
);

export type Relevances = Static<typeof openAiRelevanceResponseSchema>;
