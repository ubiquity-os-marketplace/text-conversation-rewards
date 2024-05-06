import { Static, Type } from "@sinclair/typebox";

export const contentEvaluatorConfigurationType = Type.Object({
  /**
   * Enables or disables this module
   */
  enabled: Type.Boolean(),
});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
