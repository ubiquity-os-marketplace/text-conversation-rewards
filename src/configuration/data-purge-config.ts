import { Type, Static } from "@sinclair/typebox";

export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Boolean({
    default: true,
    description: "Do not offer credit to comments posted by a user between the time they were first assigned and last unassigned from the task.",
  }),
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
