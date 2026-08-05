import type { CalculationSettings, RecipeOutput } from "@/lib/model/types";

export const DEFAULT_CALCULATION_SETTINGS: CalculationSettings = {
  probabilityMode: "expected",
  probabilityConfidence: 0.95,
  probabilityWindowSeconds: 60,
};

export function normalizeCalculationSettings(
  settings: CalculationSettings | undefined,
): CalculationSettings {
  return {
    probabilityMode: settings?.probabilityMode ?? DEFAULT_CALCULATION_SETTINGS.probabilityMode,
    probabilityConfidence: clamp(
      settings?.probabilityConfidence ?? DEFAULT_CALCULATION_SETTINGS.probabilityConfidence,
      0.5,
      0.999,
    ),
    probabilityWindowSeconds: clamp(
      settings?.probabilityWindowSeconds ?? DEFAULT_CALCULATION_SETTINGS.probabilityWindowSeconds,
      1,
      86_400,
    ),
  };
}

export function getProbabilityAdjustedOutputRate(
  output: Pick<RecipeOutput, "amount" | "chance">,
  operationRatePerSecond: number,
  settings: CalculationSettings | undefined,
): number {
  const probability = clamp(output.chance ?? 1, 0, 1);
  if (probability <= 0 || operationRatePerSecond <= 0) {
    return 0;
  }
  if (probability >= 1) {
    return output.amount * operationRatePerSecond;
  }

  const normalized = normalizeCalculationSettings(settings);
  if (normalized.probabilityMode === "expected") {
    return output.amount * probability * operationRatePerSecond;
  }

  const trials = operationRatePerSecond * normalized.probabilityWindowSeconds;
  if (trials < 1) {
    return 0;
  }

  const conservativeProbability = wilsonLowerBound(
    probability,
    trials,
    inverseStandardNormal(normalized.probabilityConfidence),
  );
  return output.amount * conservativeProbability * operationRatePerSecond;
}

export function hasProbabilisticOutputs(outputs: Array<Pick<RecipeOutput, "chance">>): boolean {
  return outputs.some(
    (output) => output.chance !== undefined && output.chance > 0 && output.chance < 1,
  );
}

function wilsonLowerBound(probability: number, trials: number, z: number): number {
  const zSquared = z * z;
  const denominator = 1 + zSquared / trials;
  const center = probability + zSquared / (2 * trials);
  const margin =
    z * Math.sqrt((probability * (1 - probability) + zSquared / (4 * trials)) / trials);
  return clamp((center - margin) / denominator, 0, probability);
}

// Peter John Acklam's inverse-normal approximation, accurate enough for UI planning bounds.
function inverseStandardNormal(probability: number): number {
  const p = clamp(probability, 0.000_001, 0.999_999);
  const a = [
    -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
    2.506628277459239,
  ];
  const b = [
    -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
    -13.28068155288572,
  ];
  const c = [
    -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;

  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= high) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
