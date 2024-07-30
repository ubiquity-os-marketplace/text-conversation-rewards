import { Static, Type } from "@sinclair/typebox";
import { CommentType } from "./comment-types";

const commentType = Type.Union([
  ...Object.keys(CommentType).map((key) => Type.Literal(key as keyof typeof CommentType)),
]);

export const contentEvaluatorConfigurationType = Type.Object({
  /**
   * Enables or disables this module
   */
  enabled: Type.Boolean({ default: true }),
  /**
   * Multipliers applied to different types of comments
   */
  multipliers: Type.Array(
    Type.Object({
      targets: Type.Array(commentType),
      relevance: Type.Optional(Type.Number()),
    }),
    {
      default: [
        {
          targets: ["ISSUE", "ISSUER", "SPECIFICATION"],
          relevance: 1,
        },
        {
          targets: ["REVIEW", "ISSUER", "TASK"],
          relevance: 1,
        },
        {
          targets: ["REVIEW", "ISSUER", "COMMENTED"],
          relevance: 1,
        },
        {
          targets: ["REVIEW", "ASSIGNEE", "COMMENTED"],
          relevance: 1,
        },
        {
          targets: ["REVIEW", "COLLABORATOR", "COMMENTED"],
          relevance: 1,
        },
        {
          targets: ["REVIEW", "CONTRIBUTOR", "COMMENTED"],
          relevance: 1,
        },
      ],
    }
  ),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
