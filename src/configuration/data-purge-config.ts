import { Type, Static } from "@sinclair/typebox";

export const dataPurgeConfigurationType = Type.Object({
  skipCommentsWhileAssigned: Type.Boolean({
    default: true,
    description: "Skip comments posted by a user while it is assigned to the issue",
  }),
});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
