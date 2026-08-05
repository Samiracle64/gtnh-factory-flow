import { describe, expect, it } from "vitest";
// @ts-expect-error The pipeline module is intentionally plain Node ESM.
import { validateDatasetQualityStats } from "../../../tools/dataset-pipeline/scripts/dataset-quality.mjs";

describe("dataset quality gate", () => {
  it("accepts a healthy daily export", () => {
    expect(
      validateDatasetQualityStats(
        {
          recipeCount: 274_176,
          neiRecipeCount: 1_394,
          neiBackgroundCount: 776,
          cropRecipeCount: 179,
          computedRuntimeCount: 180_038,
          cropVariantIds: ["23-31-1", "31-31-31", "1-1-1"],
          cropSeedIdCount: 537,
          oracleEligibleMissingCount: 0,
        },
        "daily",
      ),
    ).toMatchObject({ status: "passed" });
  });

  it("rejects silent NEI and crop regressions", () => {
    expect(() =>
      validateDatasetQualityStats(
        {
          recipeCount: 274_176,
          neiRecipeCount: 0,
          neiBackgroundCount: 0,
          cropRecipeCount: 0,
          computedRuntimeCount: 180_038,
          cropVariantIds: [],
          cropSeedIdCount: 0,
          oracleEligibleMissingCount: 0,
        },
        "daily",
      ),
    ).toThrow(/Dataset quality gate failed/);
  });
});
