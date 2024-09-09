import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

const openAiType = Type.Object(
  {
    /**
     * AI model to use for comment evaluation.
     */
    model: Type.String({ default: "gpt-4o" }),
    /**
     * Specific endpoint to send the comments to.
     */
    endpoint: Type.String({ default: "" }),
  },
  { default: {} }
);

export const contentEvaluatorConfigurationType = Type.Object({
  openAi: openAiType,
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
      ],
    }
  ),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
