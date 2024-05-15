import { Static, Type } from "@sinclair/typebox";

export const contentEvaluatorConfigurationType = Type.Object({
  /**
   * Enables or disables this module
   */
  enabled: Type.Boolean({ default: true }),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
