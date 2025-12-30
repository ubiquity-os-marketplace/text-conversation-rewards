import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

export function openAiType(overrides?: { tokenCountLimit?: number; maxRetries?: number }) {
  return Type.Object(
    {
      tokenCountLimit: Type.Integer({
        default: overrides?.tokenCountLimit ?? 124000,
        description:
          "Token count limit used when truncating prompt content before evaluation. If the content goes beyond the token limit, it will get truncated during evaluation.",
        examples: [124000],
      }),
      maxRetries: Type.Number({
        default: overrides?.maxRetries ?? 10,
        description: "Maximum number of retries to make",
        examples: [10],
      }),
    },
    { default: {} }
  );
}

export const contentEvaluatorConfigurationType = Type.Object({
  openAi: openAiType(),
  /**
   * Percentage (0.0-1.0) of reward to give to the original author when
   * "Originally posted by @username in URL" is detected
   */
  originalAuthorWeight: Type.Number({
    default: 0.5,
    description:
      "Percentage of reward given to original comment author when detected via 'Originally posted by' pattern. Value between 0.0 and 1.0.",
    minimum: 0.0,
    maximum: 1.0,
    examples: [0.5, 0.22, 0.79, 0, 1],
  }),
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
