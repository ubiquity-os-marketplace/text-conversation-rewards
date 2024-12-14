import { Static, Type } from "@sinclair/typebox";

export const reviewIncentivizerConfigurationType = Type.Object(
  {
    baseRate: Type.Number(),
    conclusiveReviewCredit: Type.Number(),
  },
  { default: {} }
);

export type ReviewIncentivizerConfiguration = Static<typeof reviewIncentivizerConfigurationType>;
