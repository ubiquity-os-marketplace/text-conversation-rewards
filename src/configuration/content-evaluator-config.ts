import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

export const contentEvaluatorConfigurationType = Type.Object({
  /**
   * Multipliers applied to different types of comments
   */
  multipliers: Type.Array(
    Type.Object({
      role: Type.Array(commentType),
      relevance: Type.Optional(Type.Number()),
    }),
    {
      default: [
        {
          role: ["ISSUE_SPECIFICATION"],
          relevance: 1,
        },
        {
          role: ["PULL_AUTHOR"],
          relevance: 1,
        },
        {
          role: ["PULL_ASSIGNEE"],
          relevance: 1,
        },
        {
          role: ["PULL_COLLABORATOR"],
          relevance: 1,
        },
        {
          role: ["PULL_CONTRIBUTOR"],
          relevance: 1,
        },
      ],
    }
  ),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
