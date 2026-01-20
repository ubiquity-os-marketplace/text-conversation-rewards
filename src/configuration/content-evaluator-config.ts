import { Static, Type } from "@sinclair/typebox";
import { commentType } from "./formatting-evaluator-config";
import { LlmCallOptions } from "@ubiquity-os/plugin-sdk/llm";

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
  }
);

type ReasoningEffort = Static<typeof reasoningEffortType>;

const defaultLlmModel = { name: "gpt-5.2", reasoningEffort: "low" } satisfies {
  name: string;
  reasoningEffort: ReasoningEffort;
};

const openAiModelType = Type.Object(
  {
    name: Type.String({
      description: "Model ID used when calling the LLM.",
      examples: ["gpt-4o", "gpt-5.2"],
    }),
    reasoningEffort: Type.Optional(reasoningEffortType),
  },
  {
    description: "Model settings including optional reasoning effort.",
    default: defaultLlmModel,
  }
);

type LlmModelType = Static<typeof openAiModelType>;

export function openAiType() {
  return Type.Object(
    {
      model: openAiModelType,
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

export function getLlmOptions(model: LlmModelType | undefined): Pick<LlmCallOptions, "reasoning_effort" | "model"> {
  const modelConfig = model;
  if (!modelConfig) throw new Error("LLM configuration not found");
  return {
    model: modelConfig.name,
    reasoning_effort: modelConfig.reasoningEffort as LlmCallOptions["reasoning_effort"],
  };
}
