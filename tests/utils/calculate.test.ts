/* eslint-disable sonarjs/no-undefined-argument */
import { describe, it, expect } from "@jest/globals";
import Decimal from "decimal.js";
import { calculateFeeString } from "../../src/utils/calculate";

describe("calculateFeeString", () => {
  it("should return '-' if netReward is 'undefined'", () => {
    const result = calculateFeeString(undefined, 10);
    expect(result).toBe("-");
  });

  it("should return '-' if feeRate is 'undefined'", () => {
    const result = calculateFeeString(100, undefined);
    expect(result).toBe("-");
  });

  it("should return '-' if feeRate is out of range (< 0)", () => {
    const result = calculateFeeString(100, -5);
    expect(result).toBe("-");
  });

  it("should return '-' if feeRate is out of range (> 100)", () => {
    const result = calculateFeeString(100, 120);
    expect(result).toBe("-");
  });

  it("should return '-' if feeRate is 100 (division by zero case)", () => {
    const result = calculateFeeString(100, 100);
    expect(result).toBe("-");
  });

  it("should calculate correct fee for valid numeric inputs", () => {
    // netReward = 100, feeRate = 10%
    // netFactor = (100 - 10) / 100 = 0.90
    // originalReward = 100 / 0.90 = 111.111...
    // fee = 111.111... - 100 = 11.111...
    // Rounded to two decimals => "11.11"
    const result = calculateFeeString(100, 10);
    expect(result).toBe("11.11");
  });

  it("should calculate zero fee if feeRate is 0%", () => {
    // netReward = 100, feeRate = 0
    // netFactor = (100 - 0) / 100 = 1
    // originalReward = 100 / 1 = 100
    // fee = 100 - 100 = 0
    // => "0.00"
    const result = calculateFeeString(100, 0);
    expect(result).toBe("0.00");
  });

  it("should handle Decimal inputs properly", () => {
    // netReward = Decimal(100.236), feeRate = Decimal(13)
    // netFactor = (100 - 13) / 100 = 0.87
    // originalReward = 100.236 / 0.87 ~= 115.2213793
    // fee ~= 115.2213793 - 100.236 = 14.9777931
    // Rounded => "14.98"
    const netReward = new Decimal(100.236);
    const feeRate = new Decimal(13);
    const result = calculateFeeString(netReward, feeRate);
    expect(result).toBe("14.98");
  });

  it("should correctly handle a larger feeRate (e.g., 90%)", () => {
    // netReward = 200, feeRate = 90
    // netFactor = (100 - 90) / 100 = 0.10
    // originalReward = 200 / 0.10 = 2000
    // fee = 2000 - 200 = 1800
    // => "1800.00"
    const result = calculateFeeString(200, 90);
    expect(result).toBe("1800.00");
  });
});
