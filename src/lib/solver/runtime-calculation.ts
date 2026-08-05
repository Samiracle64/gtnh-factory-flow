import { getVoltageTierIndex, GT_VOLTAGE_TIERS } from "@/lib/model/tiers";
import type {
  FactoryNode,
  MachineTier,
  Recipe,
  RecipeInput,
  RecipeOutput,
  RuntimeCalculationResource,
  RuntimeCalculationVariant,
} from "@/lib/model/types";

type VoltageTier = Exclude<MachineTier, "DEMO">;

export function selectRuntimeCalculationVariant(
  recipe: Pick<Recipe, "runtimeCalculation">,
  node: Pick<FactoryNode, "machineHandlerId" | "overclockTier" | "coilTier" | "machineConfigTiers">,
): RuntimeCalculationVariant | undefined {
  const variants = recipe.runtimeCalculation?.variants ?? [];
  if (recipe.runtimeCalculation?.status !== "computed" || variants.length === 0) {
    return undefined;
  }

  const matching = variants
    .map((variant) => ({ variant, score: runtimeVariantScore(variant, node) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score);

  return matching[0]?.variant;
}

export function getRuntimeCalculationOutputs(
  recipe: Pick<Recipe, "runtimeCalculation" | "outputs">,
  node: Pick<FactoryNode, "machineHandlerId" | "overclockTier" | "coilTier" | "machineConfigTiers">,
): RecipeOutput[] | undefined {
  const variant = selectRuntimeCalculationVariant(recipe, node);
  if (!variant?.outputs?.length) {
    return undefined;
  }

  return variant.outputs.map((runtimeOutput) => {
    const existing = recipe.outputs.find(
      (output) => output.kind === runtimeOutput.kind && output.id === runtimeOutput.id,
    );
    return {
      ...existing,
      kind: runtimeOutput.kind,
      id: runtimeOutput.id,
      amount: runtimeOutput.amount,
      chance: runtimeOutput.chance ?? existing?.chance,
      displayName: existing?.displayName,
      iconPath: existing?.iconPath,
      iconAtlas: existing?.iconAtlas,
      dominantColor: existing?.dominantColor,
      modId: existing?.modId,
      tooltip: existing?.tooltip,
      neiSlot: existing?.neiSlot,
      alternatives: existing?.alternatives,
      byproduct: existing?.byproduct,
    };
  });
}

export function getRuntimeCalculationInputs(
  recipe: Pick<Recipe, "runtimeCalculation" | "inputs">,
  node: Pick<FactoryNode, "machineHandlerId" | "overclockTier" | "coilTier" | "machineConfigTiers">,
): RecipeInput[] | undefined {
  const variant = selectRuntimeCalculationVariant(recipe, node);
  if (!variant?.inputs?.length) {
    return undefined;
  }

  return variant.inputs.map((runtimeInput) => {
    const exact = recipe.inputs.find(
      (input) => input.kind === runtimeInput.kind && input.id === runtimeInput.id,
    );
    const existing = exact ?? singleInputTemplate(recipe.inputs, runtimeInput.kind);
    return {
      ...existing,
      kind: runtimeInput.kind,
      id: runtimeInput.id,
      amount: runtimeInput.amount,
      displayName: existing?.displayName,
      iconPath: existing?.iconPath,
      iconAtlas: existing?.iconAtlas,
      dominantColor: existing?.dominantColor,
      modId: existing?.modId,
      tooltip: exact
        ? existing?.tooltip
        : existing?.tooltip?.filter((line) => !line.startsWith("NBT:")),
      neiSlot: existing?.neiSlot,
      alternatives: existing?.alternatives,
      optional: existing?.optional,
      consumed: existing?.consumed,
    };
  });
}

function singleInputTemplate(inputs: RecipeInput[], kind: RuntimeCalculationResource["kind"]) {
  return inputs.length === 1 && inputs[0]?.kind === kind ? inputs[0] : undefined;
}

export function runtimeCalculationWarning(
  recipe: Pick<Recipe, "runtimeCalculation" | "name">,
  node: Pick<FactoryNode, "machineHandlerId" | "overclockTier" | "coilTier" | "machineConfigTiers">,
): string | undefined {
  const runtimeCalculation = recipe.runtimeCalculation;
  if (!runtimeCalculation?.oracleEligible || !runtimeCalculation.strict) {
    return undefined;
  }
  if (selectRuntimeCalculationVariant(recipe, node)) {
    return undefined;
  }
  return `${recipe.name} has no matching GTNH runtime calculation for this machine configuration.`;
}

export function resolveRuntimeTier(
  variant: RuntimeCalculationVariant,
  fallback: VoltageTier,
): VoltageTier {
  return resolveVoltageTier(variant.overclockTier, fallback);
}

function runtimeVariantScore(
  variant: RuntimeCalculationVariant,
  node: Pick<FactoryNode, "machineHandlerId" | "overclockTier" | "coilTier" | "machineConfigTiers">,
): number {
  let score = 0;
  if (variant.machineHandlerId) {
    if (variant.machineHandlerId !== node.machineHandlerId) {
      return -1;
    }
    score += 16;
  }
  if (variant.overclockTier) {
    if (isVoltageTier(node.overclockTier) && variant.overclockTier !== node.overclockTier) {
      return -1;
    }
    score += isVoltageTier(node.overclockTier) ? 8 : 1;
  }
  if (variant.coilTier) {
    if (variant.coilTier !== node.coilTier) {
      return -1;
    }
    score += 4;
  }
  const variantConfig = variant.machineConfigTiers;
  for (const [controlId, key] of Object.entries(variantConfig ?? {})) {
    const selectedKey = node.machineConfigTiers?.[controlId];
    if (selectedKey !== undefined && selectedKey !== key) {
      return -1;
    }
    score += selectedKey === key ? 2 : 1;
  }
  return score;
}

function resolveVoltageTier(value: string | undefined, defaultTier: VoltageTier): VoltageTier {
  return GT_VOLTAGE_TIERS.find((entry) => entry.tier === value)?.tier ?? defaultTier;
}

function isVoltageTier(value: string | undefined): boolean {
  return GT_VOLTAGE_TIERS.some((entry) => entry.tier === value);
}

export function runtimeOverclockSteps(tier: VoltageTier, minimumTier: VoltageTier): number {
  return Math.max(0, getVoltageTierIndex(tier) - getVoltageTierIndex(minimumTier));
}
