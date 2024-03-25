import { Static, Type } from "@sinclair/typebox";

const userExtractorConfigurationType = Type.Object({
  enabled: Type.Boolean({ default: true }),
  redeemTask: Type.Boolean({ default: true }),
});

export type UserExtractorConfiguration = Static<typeof userExtractorConfigurationType>;

export default userExtractorConfigurationType;
