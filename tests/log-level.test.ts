import { describe, expect, it } from "@jest/globals";
import { getStartupLogLevel } from "../src/helpers/log-level";

describe("log-level helper", () => {
  it("Should default undefined values to info", () => {
    expect(getStartupLogLevel(undefined)).toBe("info");
  });

  it("Should default empty values to info", () => {
    expect(getStartupLogLevel("")).toBe("info");
  });

  it("Should default whitespace values to info", () => {
    expect(getStartupLogLevel("   ")).toBe("info");
  });

  it("Should preserve valid explicit values", () => {
    expect(getStartupLogLevel("warn")).toBe("warn");
  });

  it("Should preserve invalid non-empty values for schema validation", () => {
    expect(getStartupLogLevel("banana")).toBe("banana");
  });
});
