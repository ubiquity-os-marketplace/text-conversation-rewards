import { Static, Type } from "@sinclair/typebox";

export const permitGenerationConfigurationType = Type.Object({});

export type PermitGenerationConfiguration = Static<typeof permitGenerationConfigurationType>;
