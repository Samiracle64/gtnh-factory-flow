import { applyRecipeInputOverrides } from "@/lib/model/recipe-input-overrides";
import { applyMachineHandlerToRecipe } from "@/lib/model/recipe-rules";
import type { FactoryNode, Recipe } from "@/lib/model/types";
import { applyMachineOutputMultipliers, getMachineParallelMultiplier } from "./machine-effects";
import { getOverclockedRecipeStats, type OverclockedRecipeStats } from "./overclock";
import {
  getRuntimeCalculationInputs,
  getRuntimeCalculationOutputs,
  selectRuntimeCalculationVariant,
} from "./runtime-calculation";

type ResolvableNode = Pick<
  FactoryNode,
  "recipeInputOverrides" | "machineHandlerId" | "overclockTier" | "coilTier" | "machineConfigTiers"
>;

export interface ResolvedNodeRecipe {
  sourceRecipe: Recipe;
  nodeRecipe: Recipe;
  effectiveRecipe: Recipe;
  recipe: Recipe;
  overclockedStats: OverclockedRecipeStats;
  runtimeVariant: ReturnType<typeof selectRuntimeCalculationVariant>;
  machineParallelMultiplier: number;
}

/**
 * Resolves every node-specific recipe transformation once. Consumers must use
 * `recipe` for rates and display so runtime-oracle amounts cannot be multiplied
 * a second time by client-side machine controls.
 */
export function resolveNodeRecipe(sourceRecipe: Recipe, node: ResolvableNode): ResolvedNodeRecipe {
  const nodeRecipe = applyRecipeInputOverrides(sourceRecipe, node);
  const effectiveRecipe = applyMachineHandlerToRecipe(nodeRecipe, node);
  const overclockedStats = getOverclockedRecipeStats(effectiveRecipe, node);
  const runtimeVariant = selectRuntimeCalculationVariant(effectiveRecipe, node);
  const runtimeInputs = getRuntimeCalculationInputs(effectiveRecipe, node);
  const runtimeOutputs = getRuntimeCalculationOutputs(effectiveRecipe, node);
  const outputRecipe = runtimeOutputs
    ? { ...effectiveRecipe, outputs: runtimeOutputs }
    : applyMachineOutputMultipliers(effectiveRecipe, node, overclockedStats.tier);
  const recipe = {
    ...outputRecipe,
    inputs: runtimeInputs ?? effectiveRecipe.inputs,
    durationTicks: overclockedStats.durationTicks,
    eut: overclockedStats.eut,
  };

  return {
    sourceRecipe,
    nodeRecipe,
    effectiveRecipe,
    recipe,
    overclockedStats,
    runtimeVariant,
    machineParallelMultiplier:
      runtimeVariant?.parallel ?? getMachineParallelMultiplier(effectiveRecipe, node),
  };
}
