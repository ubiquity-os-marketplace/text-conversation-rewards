import { describe, expect, it } from "@jest/globals";
import fs from "fs";

const sql = fs.readFileSync(new URL("../scripts/permits-upsert.sql", import.meta.url), "utf-8");

const normalizeColumns = (columns: string) =>
  columns
    .split(",")
    .map((column) => column.trim().replace(/\s+/g, " "))
    .filter(Boolean);

const extractColumns = (regex: RegExp) => {
  const match = sql.match(regex);
  if (!match) {
    return null;
  }
  return normalizeColumns(match[1]);
};

describe("permits-upsert.sql", () => {
  it("keeps claimed permits from being replaced", () => {
    const guardPattern =
      /where\s+public\.permits\.transaction\s+is\s+null\s+and\s+excluded\.amount::numeric\s*>\s*public\.permits\.amount::numeric/i;
    expect(guardPattern.test(sql)).toBe(true);
  });

  it("keeps conflict columns aligned with the unique index", () => {
    const uniqueIndexColumns = extractColumns(
      /create\s+unique\s+index[^;]*permits_partner_network_permit2_nonce_unique[^;]*on\s+public\.permits\s*\(([^)]+)\)/is
    );
    const conflictColumns = extractColumns(/on\s+conflict\s*\(([^)]+)\)/is);
    expect(uniqueIndexColumns).not.toBeNull();
    expect(conflictColumns).not.toBeNull();
    expect(conflictColumns).toEqual(uniqueIndexColumns);
  });
});
