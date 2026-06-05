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
   * Weights for specialized issue-comment evaluation dimensions. Each dimension
   * is scored with a separate prompt and combined into the existing relevance
   * score using a normalized weighted average.
   */
  evaluationDimensions: Type.Object(
    {
      relevance: Type.Number({
        default: 0.5,
        minimum: 0,
        maximum: 1,
        description: "Weight for task-solving relevance: how relevant comments are to solving the specification.",
        examples: [0.5],
      }),
      helpfulness: Type.Number({
        default: 0.3,
        minimum: 0,
        maximum: 1,
        description: "Weight for contributor helpfulness: how much comments answer questions or unblock contributors.",
        examples: [0.3],
      }),
      research: Type.Number({
        default: 0.2,
        minimum: 0,
        maximum: 1,
        description:
          "Weight for research and insight value: how much comments add useful research or technical insight.",
        examples: [0.2],
      }),
    },
    {
      default: {},
      description: "Specialized prompt weights for issue comment evaluation.",
    }
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
