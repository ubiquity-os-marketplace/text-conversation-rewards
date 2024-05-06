import { Static, Type } from "@sinclair/typebox";

export const permitGenerationConfigurationType = Type.Object({
  /**
   * Enables or disabled this module
   */
  enabled: Type.Boolean(),
});

export type PermitGenerationConfiguration = Static<typeof permitGenerationConfigurationType>;
