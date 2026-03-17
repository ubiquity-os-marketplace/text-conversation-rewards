import { describe, expect, it } from "@jest/globals";
import { Value } from "@sinclair/typebox/value";
import envConfigSchema from "../src/types/env-type";

const baseEnv = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_KEY: "supabase-key",
  GITHUB_TOKEN: "github-token",
  X25519_PRIVATE_KEY: "private-key",
  PERMIT_FEE_RATE: "0",
  PERMIT_TREASURY_GITHUB_USERNAME: "ubiquity-os-treasury",
  PERMIT_ERC20_TOKENS_NO_FEE_WHITELIST: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
};

describe("env-type", () => {
  it("Should decode a missing LOG_LEVEL to info", () => {
    const decoded = Value.Decode(envConfigSchema, Value.Default(envConfigSchema, baseEnv));

    expect(decoded.LOG_LEVEL).toBe("info");
  });

  it('Should decode LOG_LEVEL="" to info', () => {
    const decoded = Value.Decode(envConfigSchema, Value.Default(envConfigSchema, { ...baseEnv, LOG_LEVEL: "" }));

    expect(decoded.LOG_LEVEL).toBe("info");
  });

  it("Should decode whitespace LOG_LEVEL to info", () => {
    const decoded = Value.Decode(envConfigSchema, Value.Default(envConfigSchema, { ...baseEnv, LOG_LEVEL: "   " }));

    expect(decoded.LOG_LEVEL).toBe("info");
  });

  it("Should preserve explicit valid LOG_LEVEL values", () => {
    const decoded = Value.Decode(envConfigSchema, Value.Default(envConfigSchema, { ...baseEnv, LOG_LEVEL: "debug" }));

    expect(decoded.LOG_LEVEL).toBe("debug");
  });

  it("Should reject invalid non-empty LOG_LEVEL values", () => {
    expect(() => {
      Value.Decode(envConfigSchema, Value.Default(envConfigSchema, { ...baseEnv, LOG_LEVEL: "banana" }));
    }).toThrow("Unable to decode value as it does not match the expected schema");
  });
});
