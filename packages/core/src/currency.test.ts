import { describe, it, expect } from "vitest";
import { toMinorUnits, toMajorUnits } from "./currency.js";

describe("currency conversion", () => {
  it("converts major to minor units using default 100x multiplier", () => {
    expect(toMinorUnits(5000, "NGN")).toBe(500000);
    expect(toMinorUnits(19.99, "USD")).toBe(1999);
  });

  it("converts minor to major units using default 100x multiplier", () => {
    expect(toMajorUnits(500000, "NGN")).toBe(5000);
    expect(toMajorUnits(1999, "USD")).toBe(19.99);
  });

  it("round-trips without drift", () => {
    const original = 12345.67;
    const minor = toMinorUnits(original, "USD");
    const back = toMajorUnits(minor, "USD");
    expect(back).toBeCloseTo(original, 2);
  });

  it("is case-insensitive for currency codes", () => {
    expect(toMinorUnits(100, "ngn")).toBe(toMinorUnits(100, "NGN"));
  });

  it("rounds fractional minor units from floating point amounts", () => {
    expect(toMinorUnits(10.005, "USD")).toBe(1001); // rounds rather than truncating oddly
  });
});
