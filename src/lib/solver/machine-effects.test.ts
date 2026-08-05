import { describe, expect, it } from "vitest";
import type { FactoryNode, Recipe } from "@/lib/model/types";
import { applyMachineHandlerToRecipe } from "@/lib/model/recipe-rules";
import { enrichPassiveProductionRecipe } from "@/lib/model/passive-production";
import { getOverclockedRecipeStats } from "./overclock";
import {
  getMachineDurationMultiplier,
  getMachineEutMultiplier,
  getMachineOutputMultiplier,
} from "./machine-effects";

describe("passive production machine effects", () => {
  it("does not invent IC2 crop multipliers in the client", () => {
    const recipe = enrichPassiveProductionRecipe(testCropRecipe());
    const lowStatsNode: Pick<FactoryNode, "machineConfigTiers" | "coilTier"> = {
      machineConfigTiers: { cropStats: "1-1-1" },
    };
    const gainNode: Pick<FactoryNode, "machineConfigTiers" | "coilTier"> = {
      machineConfigTiers: { cropStats: "23-31-0" },
    };

    expect(recipe.machineConfigControls).toEqual([]);
    expect(getMachineDurationMultiplier(recipe, lowStatsNode)).toBe(1);
    expect(getMachineOutputMultiplier(recipe, lowStatsNode, recipe.outputs[0]!, "LV")).toBe(1);
    expect(getMachineDurationMultiplier(recipe, gainNode)).toBe(1);
    expect(getMachineOutputMultiplier(recipe, gainNode, recipe.outputs[0]!, "LV")).toBe(1);
  });

  it("applies bee frame output through the Forestry production formula", () => {
    const recipe = enrichPassiveProductionRecipe(testBeeRecipe());
    const emptyNode: Pick<FactoryNode, "machineConfigTiers" | "coilTier"> = {
      machineConfigTiers: {},
    };
    const provenFramesNode: Pick<FactoryNode, "machineConfigTiers" | "coilTier"> = {
      machineConfigTiers: {
        beeFrameSlot1: "forestry:proven",
        beeFrameSlot2: "forestry:proven",
        beeFrameSlot3: "forestry:proven",
      },
    };

    expect(getMachineOutputMultiplier(recipe, emptyNode, recipe.outputs[0]!, "LV")).toBe(1);
    expect(
      getMachineOutputMultiplier(recipe, provenFramesNode, recipe.outputs[0]!, "LV"),
    ).toBeCloseTo(Math.pow(31, 0.52));
  });

  it("applies bee climate requirements to specialty outputs", () => {
    const recipe = enrichPassiveProductionRecipe({
      ...testBeeRecipe(),
      outputs: [
        {
          kind: "item",
          id: "Forestry:beeCombs@0",
          amount: 1,
          displayName: "Honey Comb",
          tooltip: ["Product chance: 30%"],
        },
        {
          kind: "item",
          id: "GTPlusPlus:hydraComb",
          amount: 1,
          displayName: "Hydra Comb",
          tooltip: ["Specialty chance: 6%", "Needs preferred climate"],
        },
      ],
    });
    const toleratedNode: Pick<FactoryNode, "machineConfigTiers" | "coilTier"> = {
      machineConfigTiers: { beeEnvironment: "tolerated" },
    };
    const wrongNode: Pick<FactoryNode, "machineConfigTiers" | "coilTier"> = {
      machineConfigTiers: { beeEnvironment: "wrong" },
    };

    expect(getMachineOutputMultiplier(recipe, toleratedNode, recipe.outputs[0]!, "LV")).toBeCloseTo(
      1,
    );
    expect(getMachineOutputMultiplier(recipe, toleratedNode, recipe.outputs[1]!, "LV")).toBe(0);
    expect(getMachineOutputMultiplier(recipe, wrongNode, recipe.outputs[0]!, "LV")).toBe(0);
  });

  it("applies bee machine handler production terms", () => {
    const recipe = enrichPassiveProductionRecipe(testBeeRecipe());
    const node: Pick<FactoryNode, "machineConfigTiers" | "machineHandlerId"> = {
      machineConfigTiers: {},
      machineHandlerId: "alveary",
    };
    const alvearyRecipe = applyMachineHandlerToRecipe(recipe, node);

    expect(getMachineOutputMultiplier(alvearyRecipe, node, recipe.outputs[0]!, "LV")).toBeCloseTo(
      Math.pow(10, 0.52),
    );
  });

  it("combines valid Industrial Apiary speed and production upgrades without voltage overclocking", () => {
    const recipe = enrichPassiveProductionRecipe(testBeeRecipe());
    const node: Pick<
      FactoryNode,
      "machineConfigTiers" | "machineHandlerId" | "coilTier" | "overclockTier"
    > = {
      machineConfigTiers: { beeIndustrialSpeed: "speed-4", beeIndustrialProduction: "4" },
      machineHandlerId: "industrial-apiary",
      overclockTier: "HV",
    };
    const industrialRecipe = applyMachineHandlerToRecipe(recipe, node);
    const stats = getOverclockedRecipeStats(industrialRecipe, node);

    expect(industrialRecipe.machineConfigControls?.map((control) => control.id)).toEqual([
      "beeIndustrialSpeed",
      "beeIndustrialProduction",
      "beeEnvironment",
    ]);
    expect(getMachineDurationMultiplier(industrialRecipe, node)).toBeCloseTo(1 / 16);
    expect(stats.tier).toBe("MV");
    expect(stats.overclockSteps).toBe(0);
    expect(stats.durationTicks).toBeCloseTo(550 / 16);
    expect(stats.eut).toBeCloseTo((37 + 2048) * 1.4 ** 4);
    expect(getMachineEutMultiplier(industrialRecipe, node)).toBeCloseTo(
      ((37 + 2048) / 37) * 1.4 ** 4,
    );
    expect(
      getMachineOutputMultiplier(industrialRecipe, node, recipe.outputs[0]!, "MV"),
    ).toBeCloseTo(Math.pow((4 * 1.2 ** 4 + 8) / 0.1, 0.52));
  });

  it("does not combine Upgraded Acceleration x256 with production upgrades", () => {
    const recipe = enrichPassiveProductionRecipe(testBeeRecipe());
    const node: Pick<FactoryNode, "machineConfigTiers" | "machineHandlerId" | "coilTier"> = {
      machineConfigTiers: { beeIndustrialSpeed: "speed-8-upgraded", beeIndustrialProduction: "8" },
      machineHandlerId: "industrial-apiary",
    };
    const industrialRecipe = applyMachineHandlerToRecipe(recipe, node);

    expect(getMachineDurationMultiplier(industrialRecipe, node)).toBeCloseTo(1 / 256);
    expect(getMachineEutMultiplier(industrialRecipe, node)).toBeCloseTo((37 + 524288) / 37);
    expect(
      getMachineOutputMultiplier(industrialRecipe, node, recipe.outputs[0]!, "MV"),
    ).toBeCloseTo(Math.pow((17.19926784 + 8) / 0.1, 0.52));
  });

  it("models Mega Apiary batching and voltage slot scaling", () => {
    const recipe = enrichPassiveProductionRecipe(testBeeRecipe());
    const node: Pick<
      FactoryNode,
      "machineConfigTiers" | "machineHandlerId" | "coilTier" | "overclockTier"
    > = {
      machineConfigTiers: { beeMegaRoyalJelly: "full" },
      machineHandlerId: "mega-apiary",
      overclockTier: "ZPM",
    };
    const megaRecipe = applyMachineHandlerToRecipe(recipe, node);
    const stats = getOverclockedRecipeStats(megaRecipe, node);

    expect(megaRecipe.durationTicks).toBe(100);
    expect(stats.durationTicks).toBe(100);
    expect(stats.eut).toBe(8110 * 4);
    expect(getMachineOutputMultiplier(megaRecipe, node, recipe.outputs[0]!, "ZPM")).toBeCloseTo(
      (6400 / 550) * 4 * 3 * Math.pow((17.19926784 + 7) / 0.1, 0.52),
    );
  });
});

function testCropRecipe(): Recipe {
  return {
    id: "ic2-crop-stickle",
    name: "IC2 Crop: Stickreed",
    machineType: "IC2 Crop",
    minimumTier: "NONE",
    durationTicks: 1200,
    eut: 0,
    inputs: [
      {
        kind: "item",
        id: "IC2:itemCropSeed@1",
        amount: 1,
        displayName: "Stickreed Seeds",
        consumed: false,
      },
    ],
    outputs: [{ kind: "item", id: "IC2:itemHarz", amount: 1, displayName: "Sticky Resin" }],
    source: { recipeMap: "IC2 Crop" },
  };
}

function testBeeRecipe(): Recipe {
  return {
    id: "bee-explosive",
    name: "Bee Produce: Explosive Bee",
    machineType: "Bee Produce",
    minimumTier: "NONE",
    durationTicks: 550,
    eut: 0,
    inputs: [
      {
        kind: "item",
        id: "factoryflow:bee_species:gregtech-explosive",
        amount: 1,
        displayName: "Explosive Bee",
        consumed: false,
      },
    ],
    outputs: [{ kind: "item", id: "IC2:blockITNT", amount: 0.02, displayName: "Industrial TNT" }],
    source: { recipeMap: "Bee Produce" },
  };
}
