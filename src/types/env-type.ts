import { Type, Static } from "@sinclair/typebox";

const envConfigSchema = Type.Object({
  SUPABASE_URL: Type.String(),
  SUPABASE_KEY: Type.String(),
  GITHUB_TOKEN: Type.String(),
  X25519_PRIVATE_KEY: Type.String(),
  OPENAI_API_KEY: Type.String(),
  NFT_MINTER_PRIVATE_KEY: Type.String(),
  NFT_CONTRACT_ADDRESS: Type.String(),
  APP_ID: Type.String(),
  UBIQUIBOT_APP_PRIVATE_KEY: Type.String(),
});

export type EnvConfigType = Static<typeof envConfigSchema>;

export default envConfigSchema;
