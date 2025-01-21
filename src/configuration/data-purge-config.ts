import { Type, Static } from "@sinclair/typebox";

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
      default: "https://openrouter.ai/api/v1",
      pattern: /^(https?:\/\/[^\s$.?#].\S*)$/i.source,
      description: "OpenAI endpoint for requests",
      examples: ["https://api.openai.com/v1"],
    }),
  },
  { default: {} }
);


export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Union([Type.Literal("all"), Type.Literal("exact"), Type.Literal("none")], {
    default: "all",
    description:
      "Configures how user comments are included in the rewards calculation when they are assigned to a GitHub issue:\n\n" +
      "- 'all': Excludes all comments made between the first assignment start and the last assignment end, discouraging gaming by un-assigning and commenting for rewards.\n" +
      "- 'exact': Excludes only comments made during precise assignment periods, targeting times when the user is actively assigned.\n" +
      "- 'none': Includes all comments, regardless of assignment status or timing.",
    examples: ["all", "exact", "none"],
  }),
  openAi: openAiType,
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
