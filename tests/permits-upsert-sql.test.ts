import { describe, expect, it } from "@jest/globals";
import fs from "fs";

const sql = fs.readFileSync(new URL("../scripts/permits-upsert.sql", import.meta.url), "utf-8");

describe("permits-upsert.sql", () => {
  it("keeps claimed permits from being replaced", () => {
    const hasTransactionGuard = sql.includes("public.permits.transaction is null");
    const hasAmountGuard = sql.includes("excluded.amount::numeric > public.permits.amount::numeric");
    expect(hasTransactionGuard).toBe(true);
    expect(hasAmountGuard).toBe(true);
  });
});
