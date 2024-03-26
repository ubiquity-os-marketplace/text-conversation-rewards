import { Type, Static } from "@sinclair/typebox";

const baseConfiguration = Type.Object({
  enabled: Type.Boolean({ default: true }),
});

export type BaseConfiguration = Static<typeof baseConfiguration>;

export default baseConfiguration;
