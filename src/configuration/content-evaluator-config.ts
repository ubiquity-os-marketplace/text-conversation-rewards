import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

const openAiType = Type.Object(
  {
    /**
     * AI model to use for comment evaluation.
     */
    model: Type.String({ default: "gpt-4o-2024-08-06", description: "OpenAI model, e.g. gpt-4o" }),
    /**
     * Specific endpoint to send the comments to.
     */
    endpoint: Type.String({
      default: "https://api.openai.com/v1",
      pattern: /^(https?:\/\/[^\s$.?#].\S*)$/i.source,
      description: "OpenAI endpoint for requests",
    }),
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
      role: Type.Array(commentType, { description: "Roles that this multiplier applies to" }),
      relevance: Type.Optional(Type.Number({ description: "Relevance multiplier for this role" })),
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
