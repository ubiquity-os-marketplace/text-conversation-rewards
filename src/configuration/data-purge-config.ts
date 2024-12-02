import { Type, Static } from "@sinclair/typebox";

export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Union([Type.Literal("all"), Type.Literal("exact"), Type.Literal("none")], {
    default: "all",
    description:
      "Do not offer credit to comments posted by a user between the time they were first assigned and last unassigned from the task.",
    examples: ["all", "exact", "none"],
  }),
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
