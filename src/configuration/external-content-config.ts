import { Static, Type } from "@sinclair/typebox";
import { openAiType } from "./content-evaluator-config";

export const externalContentConfigurationType = Type.Object(
  {
    llmWebsiteModel: openAiType(),
    llmImageModel: openAiType(),
  },
  { default: {} }
);

export type ExternalContentConfig = Static<typeof externalContentConfigurationType>;
