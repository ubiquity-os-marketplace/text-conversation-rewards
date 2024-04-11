import { Static, Type } from "@sinclair/typebox";

const permitGenerationConfigurationType = Type.Object({
  enabled: Type.Boolean(),
});

export type PermitGenerationConfiguration = Static<typeof permitGenerationConfigurationType>;

export default permitGenerationConfigurationType;
