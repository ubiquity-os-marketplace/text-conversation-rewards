import { Static, Type } from "@sinclair/typebox";
import { CommentType } from "../issue-activity";

const type = Type.Union([...Object.keys(CommentType).map((key) => Type.Literal(key as keyof typeof CommentType))]);

const formattingEvaluatorConfigurationType = Type.Object({
  enabled: Type.Boolean({ default: true }),
  multipliers: Type.Array(
    Type.Object({
      type: Type.Array(type),
      formattingMultiplier: Type.Number(),
      wordValue: Type.Number(),
    })
  ),
  scores: Type.Record(Type.String(), Type.Number()),
});

export type FormattingEvaluatorConfiguration = Static<typeof formattingEvaluatorConfigurationType>;

export default formattingEvaluatorConfigurationType;
