import { Type, Static } from "@sinclair/typebox";

export const dataPurgeConfigurationType = Type.Object({});

export type DataPurgeConfiguration = Static<typeof dataPurgeConfigurationType>;
