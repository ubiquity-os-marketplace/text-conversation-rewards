import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

const openAiType = Type.Object(
  {
    /**
     * AI model to use for comment evaluation.
     */
    model: Type.String({
      default: "anthropic/claude-3.7-sonnet",
      description: "OpenAI model, e.g. openai/gpt-4o",
      examples: ["anthropic/claude-3.7-sonnet", "openai/gpt-4o"],
    }),
    tokenCountLimit: Type.Integer({
      default: 124000,
      description:
        "Token count limit for a given model. If the content goes beyond the token limit, content will get truncated during evaluation.",
      examples: [124000],
    }),
    /**
     * Specific endpoint to send the comments to.
     */
    endpoint: Type.String({
      default: "https://openrouter.ai/api/v1",
      pattern: /^(https?:\/\/[^\s$.?#].\S*)$/i.source,
      description: "OpenAI endpoint for requests",
      examples: ["https://openrouter.ai/api/v1", "https://api.openai.com/v1"],
    }),
    maxRetries: Type.Number({
      default: 10,
      description: "Maximum number of retries to make",
      examples: ["10"],
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
