import { Type, Static } from "@sinclair/typebox";

export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Union([Type.Literal("all"), Type.Literal("exact"), Type.Literal("none")], {
    default: "all",
    description:
      "Configures how user comments are included in the rewards calculation when they are assigned to a GitHub issue:\n\n" +
      "- 'all': Excludes all comments made between the first assignment start and the last assignment end, discouraging gaming by un-assigning and commenting for rewards.\n" +
      "- 'exact': Excludes only comments made during precise assignment periods, targeting times when the user is actively assigned.\n" +
      "- 'none': Includes all comments, regardless of assignment status or timing.",
    examples: ["all", "exact", "none"],
  }),
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
