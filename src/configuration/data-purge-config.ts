import { Type, Static } from "@sinclair/typebox";

export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Union([Type.Literal("all"), Type.Literal("exact"), Type.Literal("none")], {
    default: "all",
    description:
      "Determines the comments posted by a user to include in the final rewards. 'all': excludes comments between first and last assignment. 'exact': excludes comments during the exact assignment periods. 'none': includes every comment.",
    examples: ["all", "exact", "none"],
  }),
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
