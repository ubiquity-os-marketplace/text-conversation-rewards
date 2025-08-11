import { Static, Type } from "@sinclair/typebox";

export const reviewIncentivizerConfigurationType = Type.Object(
  {
    /**
     * Number of lines of code that equals $1 in review credit
     */
    baseRate: Type.Number({
      default: 1000000,
      description: "Number of lines of code that equals $1 in review credit",
    }),
  },
  { default: {} }
);

export type ReviewIncentivizerConfiguration = Static<typeof reviewIncentivizerConfigurationType>;
