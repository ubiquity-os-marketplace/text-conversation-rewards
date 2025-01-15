import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

const openAiType = Type.Object(
  {
    /**
     * AI model to use for comment evaluation.
     */
    model: Type.String({
      default: "gpt-4o-2024-08-06",
      description: "OpenAI model, e.g. gpt-4o",
      examples: ["gpt-4o"],
    }),
    /**
     * Specific endpoint to send the comments to.
     */
    endpoint: Type.String({
      default: "https://api.openai.com/v1",
      pattern: /^(https?:\/\/[^\s$.?#].\S*)$/i.source,
      description: "OpenAI endpoint for requests",
      examples: ["https://api.openai.com/v1"],
    }),
    maxRetries: Type.Number({
      default: 3,
      description: "Maximum number of retries to make",
      examples: ["3"],
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
      role: Type.Array(commentType, {
        description: "Roles that this multiplier applies to",
        examples: ['["PULL_ASSIGNEE", "PULL_AUTHOR", "PULL_COLLABORATOR"]'],
      }),
      relevance: Type.Optional(Type.Number({ description: "Relevance multiplier for this role", examples: ["2"] })),
    }),
    {
      default: [
        {
          role: ["ISSUE_SPECIFICATION"],
          relevance: 1,
        },
      ],
      description: "Multipliers applied to different types of comments",
    }
  ),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
