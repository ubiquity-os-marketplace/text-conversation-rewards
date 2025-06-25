import { Static, Type } from "@sinclair/typebox";
import { openAiType } from "./content-evaluator-config";

export const externalContentConfigurationType = Type.Object(
  {
    llmWebsiteModel: openAiType({ model: "deepseek/deepseek-r1-0528" }),
    llmImageModel: openAiType({ model: "openai/gpt-4o-mini" }),
  },
  { default: {} }
);

export type ExternalContentConfig = Static<typeof externalContentConfigurationType>;
