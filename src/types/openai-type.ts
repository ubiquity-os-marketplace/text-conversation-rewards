import { Type, Static } from "@sinclair/typebox";

const openAiRelevanceResponseSchema = Type.Record(Type.String(), Type.Number({ minimum: 0, maximum: 1 }));

export type RelevancesByOpenAi = Static<typeof openAiRelevanceResponseSchema>;

export default openAiRelevanceResponseSchema;
