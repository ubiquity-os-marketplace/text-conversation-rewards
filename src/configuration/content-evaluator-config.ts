import { Static, Type } from "@sinclair/typebox";

const contentEvaluatorConfigurationType = Type.Object({
  enabled: Type.Boolean(),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;

export default contentEvaluatorConfigurationType;
