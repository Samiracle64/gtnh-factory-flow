const DEFAULT_THRESHOLDS = {
  stable: {
    recipeCount: 200_000,
    neiRecipeCount: 3_500,
    neiBackgroundCount: 1_500,
    cropRecipeCount: 150,
  },
  daily: {
    recipeCount: 230_000,
    neiRecipeCount: 1_200,
    neiBackgroundCount: 700,
    cropRecipeCount: 170,
    computedRuntimeCount: 170_000,
  },
};

export function validateDatasetQualityStats(stats, channel, environment = process.env) {
  const defaults = DEFAULT_THRESHOLDS[channel];
  if (!defaults) {
    throw new Error(`No dataset quality profile exists for channel "${channel}".`);
  }

  const thresholds = Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      nonNegativeInt(environment[`GTNH_QUALITY_MIN_${toEnvironmentKey(key)}`], fallback),
    ]),
  );
  const failures = [];
  for (const [key, minimum] of Object.entries(thresholds)) {
    const actual = Number(stats[key] ?? 0);
    if (actual < minimum) {
      failures.push(`${key}: ${actual} < ${minimum}`);
    }
  }

  const requiredCropVariants =
    channel === "daily" ? ["23-31-1", "31-31-31", "1-1-1"] : ["23-31-0", "31-31-31", "1-1-1"];
  for (const variantId of requiredCropVariants) {
    if (!stats.cropVariantIds?.includes(variantId)) {
      failures.push(`cropVariantIds: missing ${variantId}`);
    }
  }
  if ((stats.cropSeedIdCount ?? 0) < (stats.cropRecipeCount ?? 0) * 3) {
    failures.push(
      `cropSeedIdCount: ${stats.cropSeedIdCount ?? 0} does not preserve three NBT seed variants per crop`,
    );
  }
  if ((stats.oracleEligibleMissingCount ?? 0) > 0) {
    failures.push(`oracleEligibleMissingCount: ${stats.oracleEligibleMissingCount}`);
  }

  if (failures.length > 0) {
    throw new Error(`Dataset quality gate failed for ${channel}: ${failures.join("; ")}`);
  }
  return { thresholds, status: "passed" };
}

function toEnvironmentKey(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase();
}

function nonNegativeInt(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Dataset quality threshold must be a non-negative integer, got "${value}".`);
  }
  return parsed;
}
