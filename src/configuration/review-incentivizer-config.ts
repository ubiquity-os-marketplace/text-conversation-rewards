import { Static, Type } from "@sinclair/typebox";

export const reviewIncentivizerConfigurationType = Type.Object(
  {
    /**
     * Number of lines of code that equals $1 in review credit
     */
    baseRate: Type.Number({
      default: 100,
      description: "Number of lines of code that equals $1 in review credit",
    }),
    /**
     * Flat rate bonus in dollars for completing a conclusive review i.e (Approved or Changes Requested)
     */
    conclusiveReviewCredit: Type.Number({
      default: 25,
      description: "Flat rate bonus in dollars for completing a conclusive review i.e (Approved or Changes Requested)",
    }),
  },
  { default: {} }
);

export type ReviewIncentivizerConfiguration = Static<typeof reviewIncentivizerConfigurationType>;
