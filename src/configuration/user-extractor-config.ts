import { Static, Type } from "@sinclair/typebox";

export const userExtractorConfigurationType = Type.Object({
  /**
   * Is the task redeemable, e.g. can the user collect the bounty?
   */
  redeemTask: Type.Boolean({
    default: true,
    description: "Is the task redeemable, e.g. can the user collect the bounty?",
  }),
});

export type UserExtractorConfiguration = Static<typeof userExtractorConfigurationType>;
