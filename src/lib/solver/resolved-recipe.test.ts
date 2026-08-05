import { describe, expect, it } from "vitest";
import type { FactoryNode, Recipe } from "@/lib/model/types";
import { resolveNodeRecipe } from "./resolved-recipe";

describe("resolveNodeRecipe", () => {
  it("uses one exact crop runtime variant without reapplying config multipliers", () => {
    const recipe: Recipe = {
      id: "stickreed",
      name: "IC2 Crop: Stickreed",
      kind: "crop_produce",
      machineType: "IC2 Crop",
      minimumTier: "NONE",
      durationTicks: 8704,
      eut: 0,
      inputs: [{ kind: "item", id: "ic2:itemcropseed#nbt-abc", amount: 1, consumed: false }],
      outputs: [{ kind: "item", id: "ic2:itemharz", amount: 2.740621 }],
      machineConfigControls: [
        {
          id: "cropStats",
          label: "Crop Stats",
          minimumKey: "1-1-1",
          defaultKey: "23-31-0",
          tiers: [
            {
              key: "1-1-1",
              label: "1/1/1",
              outputMultiplier: 99,
              durationMultiplier: 99,
              resource: { kind: "item", id: "stats:low", amount: 1 },
            },
          ],
        },
      ],
      runtimeCalculation: {
        sourceKind: "passive-crop",
        status: "computed",
        oracleEligible: true,
        strict: true,
        variants: [
          {
            id: "1-1-1",
            machineConfigTiers: { cropStats: "1-1-1" },
            durationTicks: 8704,
            eut: 0,
            outputs: [{ kind: "item", id: "ic2:itemharz", amount: 0.865619 }],
          },
        ],
      },
    };
    const node: Pick<
      FactoryNode,
      | "recipeInputOverrides"
      | "machineHandlerId"
      | "overclockTier"
      | "coilTier"
      | "machineConfigTiers"
    > = {
      overclockTier: "NONE",
      machineConfigTiers: {
        cropStats: "1-1-1",
        cropHydration: "hydrated",
      },
    };

    const resolved = resolveNodeRecipe(recipe, node);

    expect(resolved.runtimeVariant?.id).toBe("1-1-1");
    expect(resolved.recipe.durationTicks).toBe(8704);
    expect(resolved.recipe.outputs[0]?.amount).toBe(0.865619);
  });
});
