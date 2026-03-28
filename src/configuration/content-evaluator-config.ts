import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

const reasoningEffortType = Type.Union(
  [
    Type.Literal("none"),
    Type.Literal("minimal"),
    Type.Literal("low"),
    Type.Literal("medium"),
    Type.Literal("high"),
    Type.Literal("xhigh"),
  ],
  {
    description: "Reasoning effort level for reasoning-capable models.",
    examples: ["medium", "low", "high"],
    default: "low",
  }
);

export function openAiType() {
  return Type.Object(
    {
      tokenCountLimit: Type.Integer({
        default: 124000,
        description:
          "Token count limit used when truncating prompt content before evaluation. If the content goes beyond the token limit, it will get truncated during evaluation.",
        examples: [124000],
      }),
      maxRetries: Type.Number({
        default: 10,
        description: "Maximum number of retries to make",
        examples: [10],
      }),
      reasoningEffort: reasoningEffortType,
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
   * Weights for the specialized evaluation dimensions. Each prompt evaluates
   * a different aspect and the final score is a weighted sum.
   * Weights should sum to 1.0 for normalized scores.
   */
  evaluationDimensions: Type.Object(
    {
      relevance: Type.Number({
        default: 0.33,
        minimum: 0,
        maximum: 1,
        description: "Weight for relevance scoring: how relevant are comments to solving the spec.",
      }),
      helpfulness: Type.Number({
        default: 0.33,
        minimum: 0,
        maximum: 1,
        description: "Weight for helpfulness scoring: how helpful are comments to answer contributor questions.",
      }),
      research: Type.Number({
        default: 0.34,
        minimum: 0,
        maximum: 1,
        description: "Weight for research scoring: how useful are comments for adding research and insights.",
      }),
    },
    { default: { relevance: 0.33, helpfulness: 0.33, research: 0.34 } }
  ),
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
