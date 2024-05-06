import { Static, Type } from "@sinclair/typebox";

export const userExtractorConfigurationType = Type.Object({
  /**
   * Enables or disabled this module
   */
  enabled: Type.Boolean({ default: true }),
  /**
   * Is the task redeemable, e.g. can the user collect the bounty?
   */
  redeemTask: Type.Boolean({ default: true }),
});

export type UserExtractorConfiguration = Static<typeof userExtractorConfigurationType>;
