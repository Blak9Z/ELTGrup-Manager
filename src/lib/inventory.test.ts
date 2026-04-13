import { describe, expect, it } from "vitest";
import { calculateAvailableStock } from "./inventory";

describe("calculateAvailableStock", () => {
  it("returns available stock from incoming and outgoing totals", () => {
    expect(calculateAvailableStock(145.5, 43.25)).toBe(102.25);
  });

  it("supports negative values when outgoing exceeds incoming", () => {
    expect(calculateAvailableStock(10, 15)).toBe(-5);
  });
});
