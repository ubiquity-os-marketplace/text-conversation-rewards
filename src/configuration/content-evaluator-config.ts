import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";

export const defaultEvaluationDimensions = [
  {
    name: "specification-relevance",
    weight: 0.5,
    prompt: "Rank from 0 to 1 how directly each comment helps solve the issue specification.",
  },
  {
    name: "contributor-assistance",
    weight: 0.25,
    prompt: "Rank from 0 to 1 how helpful each comment is for answering contributor questions or unblocking work.",
  },
  {
    name: "research-insight",
    weight: 0.25,
    prompt: "Rank from 0 to 1 how useful each comment is for adding research, context, or project insight.",
  },
];

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

const evaluationDimensionType = Type.Object({
  name: Type.String({
    minLength: 1,
    description: "Stable name for this evaluation dimension.",
    examples: ["specification-relevance"],
  }),
  weight: Type.Number({
    minimum: 0,
    description: "Relative weight applied to this dimension when calculating the final relevance score.",
    examples: [0.5, 1],
  }),
  prompt: Type.String({
    minLength: 1,
    description: "Instruction used when evaluating this dimension.",
    examples: ["Rank from 0 to 1 how directly each comment helps solve the issue specification."],
  }),
});

export const contentEvaluatorConfigurationType = Type.Object({
  openAi: openAiType(),
  evaluationDimensions: Type.Array(evaluationDimensionType, {
    minItems: 1,
    default: defaultEvaluationDimensions,
    description:
      "Separate evaluation dimensions used to score comments. Each dimension is evaluated independently and then combined by weight.",
  }),
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
