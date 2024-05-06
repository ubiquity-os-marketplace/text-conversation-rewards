import { Static, Type } from "@sinclair/typebox";
import { CommentType } from "./comment-types";

const type = Type.Union([...Object.keys(CommentType).map((key) => Type.Literal(key as keyof typeof CommentType))]);

export const formattingEvaluatorConfigurationType = Type.Object({
  /**
   * Enables or disabled this module
   */
  enabled: Type.Boolean({ default: true }),
  /**
   * Multipliers applied to different parts of the comment body content
   */
  multipliers: Type.Array(
    Type.Object({
      type: Type.Array(type),
      formattingMultiplier: Type.Number(),
      wordValue: Type.Number(),
    })
  ),
  /**
   * Attributed score per HTML entity
   */
  scores: Type.Record(Type.String(), Type.Number()),
});

export type FormattingEvaluatorConfiguration = Static<typeof formattingEvaluatorConfigurationType>;
