import { Static, Type } from "@sinclair/typebox";
import { openAiType } from "./content-evaluator-config";

export const externalContentConfigurationType = Type.Object(
  {
    llmImageModel: openAiType({ model: "deepseek/deepseek-r1-0528-qwen3-8b" }),
    llmWebsiteModel: openAiType({ model: "openai/gpt-4o-mini" }),
  },
  { default: {} }
);

export type ExternalContentConfig = Static<typeof externalContentConfigurationType>;
