import { StaticDecode, Type } from "@sinclair/typebox";
import { LOG_LEVEL } from "@ubiquity-os/ubiquity-os-logger";

const logLevelEnvSchema = Type.Transform(
  Type.Union([Type.Enum(LOG_LEVEL), Type.String({ pattern: "^\\s*$" })], { default: LOG_LEVEL.INFO })
)
  .Decode((value) => {
    return typeof value === "string" && value.trim() === "" ? LOG_LEVEL.INFO : value;
  })
  .Encode((value) => value);

const envConfigSchema = Type.Object({
  SUPABASE_URL: Type.String(),
  SUPABASE_KEY: Type.String(),
  GITHUB_TOKEN: Type.String(),
  X25519_PRIVATE_KEY: Type.String(),
  NFT_MINTER_PRIVATE_KEY: Type.Optional(Type.String()),
  NFT_CONTRACT_ADDRESS: Type.Optional(Type.String()),
  PERMIT_FEE_RATE: Type.String(),
  PERMIT_TREASURY_GITHUB_USERNAME: Type.String(),
  PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST: Type.String(),
  KERNEL_PUBLIC_KEY: Type.Optional(Type.String()),
  LOG_LEVEL: logLevelEnvSchema,
});

export type EnvConfig = StaticDecode<typeof envConfigSchema>;

export default envConfigSchema;
