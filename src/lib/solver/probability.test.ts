import { describe, expect, it } from "vitest";
import { getProbabilityAdjustedOutputRate } from "./probability";

describe("probability output rates", () => {
  it("preserves the long-run expected output mode", () => {
    expect(
      getProbabilityAdjustedOutputRate({ amount: 2, chance: 0.25 }, 4, {
        probabilityMode: "expected",
        probabilityConfidence: 0.95,
        probabilityWindowSeconds: 60,
      }),
    ).toBe(2);
  });

  it("uses a lower confidence bound in reliable mode", () => {
    const expected = getProbabilityAdjustedOutputRate({ amount: 1, chance: 0.25 }, 10, {
      probabilityMode: "expected",
      probabilityConfidence: 0.95,
      probabilityWindowSeconds: 60,
    });
    const reliable = getProbabilityAdjustedOutputRate({ amount: 1, chance: 0.25 }, 10, {
      probabilityMode: "reliable",
      probabilityConfidence: 0.95,
      probabilityWindowSeconds: 60,
    });

    expect(reliable).toBeGreaterThan(0);
    expect(reliable).toBeLessThan(expected);
  });

  it("does not discount deterministic outputs", () => {
    expect(
      getProbabilityAdjustedOutputRate({ amount: 3, chance: 1 }, 2, {
        probabilityMode: "reliable",
        probabilityConfidence: 0.99,
        probabilityWindowSeconds: 60,
      }),
    ).toBe(6);
  });

  it("returns zero when fewer than one trials occurs in the reliability window", () => {
    expect(
      getProbabilityAdjustedOutputRate({ amount: 1, chance: 0.5 }, 0.01, {
        probabilityMode: "reliable",
        probabilityConfidence: 0.95,
        probabilityWindowSeconds: 60,
      }),
    ).toBe(0);
  });
});
