import { Static, Type } from "@sinclair/typebox";

export const simplificationIncentivizerConfigurationType = Type.Object(
  {
    /**
     * The amount of lines simplified to be credited 1$ of incentive.
     */
    simplificationRate: Type.Number({
      default: 100,
      description: "The amount of lines simplified to be credited 1$ of incentive",
      examples: ["100"],
    }),
  },
  { default: {} }
);

export type SimplificationIncentivizerConfiguration = Static<typeof simplificationIncentivizerConfigurationType>;
