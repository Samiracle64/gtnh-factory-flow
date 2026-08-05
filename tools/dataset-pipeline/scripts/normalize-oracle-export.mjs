import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { PNG } from "pngjs";
import { writeDatasetJson } from "./dataset-json-writer.mjs";
import { getDominantOpaqueColor } from "./icon-utils.mjs";

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const GT_VOLTAGE_NAMES = [
  "ULV",
  "LV",
  "MV",
  "HV",
  "EV",
  "IV",
  "LuV",
  "ZPM",
  "UV",
  "UHV",
  "UEV",
  "UIV",
  "UXV",
  "OpV",
  "MAX",
];
const heatingCoilTiers = [
  { heat: 1801, key: "cupronickel", label: "Cupronickel", blockId: "gregtech:gt.blockcasings5" },
  { heat: 2701, key: "kanthal", label: "Kanthal", blockId: "gregtech:gt.blockcasings5@1" },
  { heat: 3601, key: "nichrome", label: "Nichrome", blockId: "gregtech:gt.blockcasings5@2" },
  { heat: 4501, key: "tpv", label: "TPV-Alloy", blockId: "gregtech:gt.blockcasings5@3" },
  { heat: 5401, key: "hss_g", label: "HSS-G", blockId: "gregtech:gt.blockcasings5@4" },
  { heat: 6301, key: "hss_s", label: "HSS-S", blockId: "gregtech:gt.blockcasings5@9" },
  { heat: 7201, key: "naquadah", label: "Naquadah", blockId: "gregtech:gt.blockcasings5@5" },
  {
    heat: 8101,
    key: "naquadah_alloy",
    label: "Naquadah Alloy",
    blockId: "gregtech:gt.blockcasings5@6",
  },
  { heat: 9001, key: "trinium", label: "Trinium", blockId: "gregtech:gt.blockcasings5@10" },
  {
    heat: 9901,
    key: "electrum_flux",
    label: "Electrum Flux",
    blockId: "gregtech:gt.blockcasings5@7",
  },
  {
    heat: 10801,
    key: "awakened_draconium",
    label: "Awakened Draconium",
    blockId: "gregtech:gt.blockcasings5@8",
  },
  { heat: 11701, key: "infinity", label: "Infinity", blockId: "gregtech:gt.blockcasings5@11" },
  { heat: 12601, key: "hypogen", label: "Hypogen", blockId: "gregtech:gt.blockcasings5@12" },
  { heat: 13501, key: "eternal", label: "Eternal", blockId: "gregtech:gt.blockcasings5@13" },
];
const pipeCasingTiers = [
  { key: "bronze", label: "Bronze", blockId: "gregtech:gt.blockcasings2@12" },
  { key: "steel", label: "Steel", blockId: "gregtech:gt.blockcasings2@13" },
  { key: "titanium", label: "Titanium", blockId: "gregtech:gt.blockcasings2@14" },
  { key: "tungstensteel", label: "Tungstensteel", blockId: "gregtech:gt.blockcasings2@15" },
  { key: "ptfe", label: "PTFE", blockId: "gregtech:gt.blockcasings8@1" },
  { key: "pbi", label: "PBI", blockId: "gregtech:gt.blockcasings9" },
];
const solenoidTiers = [
  { key: "mv", label: "MV", blockId: "gregtech:gt.blockcasings.cyclotron_coils", voltageTier: 2 },
  { key: "hv", label: "HV", blockId: "gregtech:gt.blockcasings.cyclotron_coils@1", voltageTier: 3 },
  { key: "ev", label: "EV", blockId: "gregtech:gt.blockcasings.cyclotron_coils@2", voltageTier: 4 },
  { key: "iv", label: "IV", blockId: "gregtech:gt.blockcasings.cyclotron_coils@3", voltageTier: 5 },
  {
    key: "luv",
    label: "LuV",
    blockId: "gregtech:gt.blockcasings.cyclotron_coils@4",
    voltageTier: 6,
  },
  {
    key: "zpm",
    label: "ZPM",
    blockId: "gregtech:gt.blockcasings.cyclotron_coils@5",
    voltageTier: 7,
  },
  { key: "uv", label: "UV", blockId: "gregtech:gt.blockcasings.cyclotron_coils@6", voltageTier: 8 },
  {
    key: "uhv",
    label: "UHV",
    blockId: "gregtech:gt.blockcasings.cyclotron_coils@7",
    voltageTier: 9,
  },
  {
    key: "uev",
    label: "UEV",
    blockId: "gregtech:gt.blockcasings.cyclotron_coils@8",
    voltageTier: 10,
  },
  {
    key: "uiv",
    label: "UIV",
    blockId: "gregtech:gt.blockcasings.cyclotron_coils@9",
    voltageTier: 11,
  },
  {
    key: "umv",
    label: "UMV",
    blockId: "gregtech:gt.blockcasings.cyclotron_coils@10",
    voltageTier: 12,
  },
];

if (!inputPath || !outputPath) {
  throw new Error("Usage: normalize-oracle-export.mjs <oracle.json> <recipes.json>");
}

const datasetVersionId = requiredEnv("GTNH_DATASET_VERSION_ID");
const gtnhVersion = requiredEnv("GTNH_DATASET_VERSION_LABEL");
const generatedAt = new Date().toISOString();
const outDir = path.dirname(outputPath);
const renderedIconDir = process.env.GTNH_RENDERED_ICON_DIR;
const oracleStrict = envFlag("GTNH_ORACLE_STRICT", false);

const raw = JSON.parse(stripBom(await fs.readFile(inputPath, "utf8")));
const renderedIcons = await stageRenderedIcons(renderedIconDir, outDir);

const resources = new Map();
const recipes = [];
const recipeMaps = new Set();
const recipeMapIcons = new Map();
const recipeSignatures = new Set();
const normalizationFailures = [];
const oreDictionaryAlternativesByName = new Map();
const oreDictionary = normalizeOreDictionary(findDomain("oreDictionary")?.entries ?? {});

normalizeGregtech(findDomain("gregtech"));
normalizeCrafting(findDomain("crafting"));
normalizeSmelting(findDomain("smelting"));
normalizeThaumcraft(findDomain("thaumcraft"));
normalizeForestryBees(findDomain("forestryBees"));
normalizeIc2Crops(findDomain("ic2Crops"));

const dataset = {
  schemaVersion: 1,
  datasetVersionId,
  gtnhVersion,
  sourceInfo: {
    sourceId: "gtnh-oracle",
    sourceVersion: raw.format ?? "dev.gtnhplanner.oracle.v1",
    generatedAt,
    notes:
      "Generated by a GTNH JVM oracle mod from live Forge/Minecraft/GTNH registries. Unsupported detected adapters are listed in oracle-report.json.",
  },
  resources: [...resources.values()].sort(compareById),
  recipes,
  oreDictionary,
  recipeMaps: [...recipeMaps].sort(),
  recipeMapIcons: [...recipeMapIcons.entries()]
    .map(([recipeMap, resource]) => ({ recipeMap, resource: compactRecipeResource(resource) }))
    .sort((left, right) => left.recipeMap.localeCompare(right.recipeMap)),
  generatedAt,
};

if (dataset.recipes.length === 0) {
  throw new Error("Oracle normalization produced zero recipes.");
}

await writeOracleReport(dataset);
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await writeDatasetJson(outputPath, dataset);
console.log(`Wrote ${dataset.recipes.length} oracle recipe(s) to ${outputPath}.`);

function normalizeGregtech(domain) {
  for (const recipeMap of domain?.recipeMaps ?? []) {
    const machineType = text(recipeMap.name, recipeMap.id ?? "GregTech");
    recipeMaps.add(machineType);
    setRecipeMapIcon(machineType, recipeMap.icon);
    const catalystControls = machineConfigControlsFromCatalysts(recipeMap.catalysts);
    for (const rawRecipe of recipeMap.recipes ?? []) {
      const exportedNei = normalizeGregtechNeiLayout(rawRecipe.neiLayout);
      let itemInputIndex = 0;
      let fluidInputIndex = 0;
      let itemOutputIndex = 0;
      let fluidOutputIndex = 0;
      const inputs = [
        ...(rawRecipe.itemInputs ?? []).map((entry) =>
          resourceAmount(entry, {
            consumed: entry.consumed === false ? false : undefined,
            neiSlot: exportedNeiSlot(exportedNei, "input", "item", itemInputIndex++),
          }),
        ),
        ...(rawRecipe.nonConsumedInputs ?? []).map((entry) =>
          resourceAmount(entry, {
            consumed: false,
            neiSlot: exportedNeiSlot(exportedNei, "input", "item", itemInputIndex++),
          }),
        ),
        ...(rawRecipe.fluidInputs ?? []).map((entry) =>
          resourceAmount(entry, {
            neiSlot: exportedNeiSlot(exportedNei, "input", "fluid", fluidInputIndex++),
          }),
        ),
      ].filter(Boolean);
      const outputs = [
        ...(rawRecipe.itemOutputs ?? []).map((entry) =>
          resourceAmount(entry, {
            chance: entry.chance,
            neiSlot: exportedNeiSlot(exportedNei, "output", "item", itemOutputIndex++),
          }),
        ),
        ...(rawRecipe.fluidOutputs ?? []).map((entry) =>
          resourceAmount(entry, {
            neiSlot: exportedNeiSlot(exportedNei, "output", "fluid", fluidOutputIndex++),
          }),
        ),
      ].filter(Boolean);

      if (outputs.length === 0) {
        continue;
      }
      const machineConfigControls = machineConfigControlsForOracleRecipe(
        machineType,
        rawRecipe.specialValue,
        catalystControls,
      );

      addRecipe({
        id: recipeId("gregtech", recipeMap.id, rawRecipe.id),
        name: `${machineType}: ${resourceLabel(outputs[0])}`,
        kind: "gregtech_machine",
        category: "gregtech",
        machineType,
        minimumTier: voltageTierForEu(rawRecipe.eut ?? 0),
        durationTicks: positiveInt(rawRecipe.durationTicks, 1),
        eut: Math.max(0, Number(rawRecipe.eut) || 0),
        inputs,
        outputs,
        machineConfigControls,
        runtimeCalculation: normalizeRuntimeCalculation(
          rawRecipe.runtimeCalculation,
          machineType,
          outputs,
        ),
        programmedCircuit: detectProgrammedCircuit(inputs),
        specialValue: Number(rawRecipe.specialValue) || 0,
        notes: "Exported by the GTNH calculation oracle from gregtech.api.recipe.RecipeMap.",
        source: {
          datasetVersionId,
          recipeMap: machineType,
          exporter: "gtnh-oracle",
          rawRecipeId: `${recipeMap.id}:${rawRecipe.id}`,
        },
        nei: {
          ...(exportedNei ?? {}),
          additionalInfo: [`Special value: ${rawRecipe.specialValue ?? 0}`],
        },
        metadata: {
          recipeMapId: recipeMap.id,
          specialValue: Number(rawRecipe.specialValue) || 0,
        },
      });
    }
  }
}

function normalizeGregtechNeiLayout(rawLayout) {
  if (!rawLayout || typeof rawLayout !== "object") {
    return undefined;
  }
  const slots = (rawLayout.slots ?? [])
    .map((slot) => {
      const side = slot.side === "input" || slot.side === "output" ? slot.side : undefined;
      const kind = ["item", "fluid", "aspect"].includes(slot.kind) ? slot.kind : undefined;
      const slotIndex = Number(slot.slotIndex);
      const x = Number(slot.x);
      const y = Number(slot.y);
      if (
        !side ||
        !kind ||
        !Number.isInteger(slotIndex) ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return undefined;
      }
      return { side, kind, slotIndex, x: Math.round(x), y: Math.round(y) };
    })
    .filter(Boolean);
  const progressBars = (rawLayout.progressBars ?? [])
    .map((bar) => {
      const x = Number(bar.x);
      const y = Number(bar.y);
      const width = Number(bar.width);
      const height = Number(bar.height);
      const rawDirection = String(bar.direction ?? "right").toLowerCase();
      const direction = rawDirection.includes("up")
        ? "up"
        : rawDirection.includes("circular")
          ? "circular"
          : "right";
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
        return undefined;
      }
      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        direction,
        texture: text(bar.texture, "arrow"),
      };
    })
    .filter(Boolean);
  const width = Number(rawLayout.canvas?.width);
  const height = Number(rawLayout.canvas?.height);
  const slotCapacity = Object.fromEntries(
    ["maxItemInputs", "maxItemOutputs", "maxFluidInputs", "maxFluidOutputs"].flatMap((key) => {
      const value = Number(rawLayout.slotCapacity?.[key]);
      return Number.isInteger(value) && value >= 0 ? [[key, value]] : [];
    }),
  );
  return removeUndefined({
    source: text(rawLayout.source, "gregtech-recipe-map-frontend"),
    handlerClass: text(rawLayout.handlerClass, undefined),
    backgroundImage: text(rawLayout.backgroundImage, undefined),
    canvas:
      Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
        ? { width: Math.round(width), height: Math.round(height) }
        : undefined,
    slotCapacity: Object.keys(slotCapacity).length > 0 ? slotCapacity : undefined,
    slots,
    progressBars,
  });
}

function exportedNeiSlot(nei, side, kind, slotIndex) {
  const slot = nei?.slots?.find(
    (candidate) =>
      candidate.side === side && candidate.kind === kind && candidate.slotIndex === slotIndex,
  );
  return slot ? { x: slot.x, y: slot.y } : undefined;
}

function normalizeCrafting(domain) {
  for (const rawRecipe of domain?.recipes ?? []) {
    const output = resourceAmount(rawRecipe.output, { neiSlot: { x: 124, y: 26 } });
    if (!output) {
      continue;
    }
    const machineType = rawRecipe.type === "shapeless" ? "Shapeless Crafting" : "Shaped Crafting";
    recipeMaps.add(machineType);
    setRecipeMapIcon(machineType, {
      kind: "item",
      id: "minecraft:crafting_table",
      amount: 1,
      displayName: "Crafting Table",
    });
    const craftingInputs = (rawRecipe.inputs ?? [])
      .map((entry, index) =>
        resourceAmount(entry, {
          neiSlot: craftingInputNeiSlot(rawRecipe, entry.slotIndex ?? index),
        }),
      )
      .filter(Boolean);
    const inputGrid = craftingInputGrid(rawRecipe);
    addRecipe({
      id: recipeId("crafting", rawRecipe.type, rawRecipe.id),
      name: `${machineType}: ${resourceLabel(output)}`,
      kind: "gregtech_machine",
      category: "crafting",
      machineType,
      minimumTier: "NONE",
      durationTicks: 1,
      eut: 0,
      inputs: craftingInputs,
      outputs: [output],
      notes: "Exported by the GTNH calculation oracle from Minecraft/Forge crafting registries.",
      source: {
        datasetVersionId,
        recipeMap: machineType,
        exporter: "gtnh-oracle",
        rawRecipeId: rawRecipe.id,
      },
      nei: {
        itemInputGrid: inputGrid,
        itemOutputGrid: { width: 1, height: 1 },
        slots: craftingNeiSlots(rawRecipe, craftingInputs.length),
        progressBars: [{ x: 84, y: 26, width: 24, height: 17, direction: "right" }],
      },
    });
  }
}

function normalizeSmelting(domain) {
  const machineType = "Furnace";
  for (const rawRecipe of domain?.recipes ?? []) {
    const input = resourceAmount(rawRecipe.input);
    const output = resourceAmount(rawRecipe.output);
    if (!input || !output) {
      continue;
    }
    recipeMaps.add(machineType);
    addRecipe({
      id: recipeId("smelting", rawRecipe.id),
      name: `${machineType}: ${resourceLabel(output)}`,
      kind: "gregtech_machine",
      category: "furnace",
      machineType,
      minimumTier: "NONE",
      durationTicks: 200,
      eut: 0,
      inputs: [input],
      outputs: [output],
      notes: "Exported by the GTNH calculation oracle from FurnaceRecipes.",
      source: {
        datasetVersionId,
        recipeMap: machineType,
        exporter: "gtnh-oracle",
        rawRecipeId: rawRecipe.id,
      },
    });
  }
}

function normalizeThaumcraft(domain) {
  for (const rawRecipe of domain?.recipes ?? []) {
    const normalizedRecipe = normalizeThaumcraftRecipe(rawRecipe);
    const outputs = normalizedRecipe.outputs?.length
      ? normalizedRecipe.outputs
      : normalizedRecipe.output
        ? [normalizedRecipe.output]
        : [];
    const output = outputs[0];
    if (!output || outputs.length === 0) {
      continue;
    }
    const machineType = thaumcraftMachineType(rawRecipe.type);
    const inputs = normalizedRecipe.inputs;

    recipeMaps.add(machineType);
    setRecipeMapIcon(
      machineType,
      rawRecipe.neiLayout?.category?.icon ?? thaumcraftRecipeMapIcon(rawRecipe.type),
    );
    const durationTicks = positiveInt(rawRecipe.durationTicks, thaumcraftDuration(rawRecipe.type));
    addRecipe({
      id: recipeId("thaumcraft", rawRecipe.type, rawRecipe.id),
      name: `${machineType}: ${resourceLabel(output)}`,
      kind: rawRecipe.type === "essentiaSmelting" ? "essentia_smelting" : "gregtech_machine",
      category: "thaumcraft",
      machineType,
      minimumTier: "NONE",
      durationTicks,
      eut: 0,
      inputs,
      outputs,
      runtimeCalculation: {
        sourceKind: "thaumcraft-runtime",
        sourceClass: rawRecipe.className,
        recipeMap: machineType,
        status: "computed",
        oracleEligible: true,
        strict: true,
        generatedAt,
        variants: [
          {
            id: "base",
            label: text(rawRecipe.type, "Thaumcraft"),
            durationTicks,
            eut: 0,
            outputs: runtimeResources(outputs),
            notes: rawRecipe.durationSource
              ? `Duration exported from ${rawRecipe.durationSource}.`
              : undefined,
          },
          ...(rawRecipe.variants ?? []).map((variant) => ({
            id: text(variant.id, "variant"),
            label: text(variant.label, "Variant"),
            durationTicks: positiveInt(variant.durationTicks, durationTicks),
            eut: 0,
            outputs: runtimeResources(outputs),
            notes:
              variant.bellows !== undefined
                ? `Alchemical Furnace bellows: ${variant.bellows}.`
                : undefined,
          })),
        ],
      },
      notes: [
        `Exported by the GTNH calculation oracle from ${rawRecipe.className}.`,
        rawRecipe.research ? `Research: ${rawRecipe.research}` : undefined,
        rawRecipe.instability !== undefined ? `Instability: ${rawRecipe.instability}` : undefined,
        rawRecipe.notes,
      ]
        .filter(Boolean)
        .join(" "),
      source: {
        datasetVersionId,
        recipeMap: machineType,
        exporter: "gtnh-oracle",
        rawRecipeId: rawRecipe.id,
      },
      nei: normalizedRecipe.nei,
      metadata: {
        thaumcraftType: rawRecipe.type,
        research: rawRecipe.research,
        instability: rawRecipe.instability,
      },
    });
  }
}

function normalizeThaumcraftRecipe(rawRecipe) {
  const exportedLayout = normalizeExportedNeiLayout(rawRecipe.neiLayout);
  if (exportedLayout) {
    return exportedLayout;
  }

  const type = text(rawRecipe.type, "thaumcraft");
  const inputs = [];
  const slots = [];
  const progressBars = [];
  const addSlot = (side, kind, slotIndex, slot) => {
    if (!slot) return;
    slots.push({ side, kind, slotIndex, x: slot.x, y: slot.y });
  };
  const addInput = (rawResource, slot, slotIndex) => {
    const resource = resourceAmount(rawResource, { neiSlot: slot });
    if (!resource) return;
    inputs.push(resource);
    addSlot("input", resource.kind, slotIndex, slot);
  };

  const outputSlot =
    type === "infusion"
      ? { x: 75, y: 1 }
      : type === "crucible"
        ? { x: 76, y: 8 }
        : type === "essentiaSmelting"
          ? undefined
          : { x: 74, y: 2 };
  const output = resourceAmount(rawRecipe.output, { neiSlot: outputSlot });
  if (output) {
    addSlot("output", output.kind, 0, outputSlot);
  }

  if (type === "essentiaSmelting") {
    addInput(rawRecipe.input, { x: 42, y: 34 }, 0);
    const aspectSlots = thaumcraftAspectSlots(
      (rawRecipe.outputs ?? rawRecipe.aspects ?? []).length,
      112,
      34,
    );
    const outputs = (rawRecipe.outputs ?? rawRecipe.aspects ?? [])
      .map((entry, index) => resourceAmount(entry, { neiSlot: aspectSlots[index] }))
      .filter(Boolean);
    outputs.forEach((resource, index) =>
      slots.push({
        side: "output",
        kind: resource.kind,
        slotIndex: index,
        x: aspectSlots[index].x,
        y: aspectSlots[index].y,
      }),
    );
    progressBars.push({ x: 72, y: 35, width: 24, height: 17, direction: "right" });
    return {
      output: outputs[0],
      outputs,
      inputs,
      nei: { slots, progressBars },
    };
  } else if (type === "infusion") {
    addInput(rawRecipe.centralInput ?? rawRecipe.catalyst, { x: 75, y: 58 }, 0);
    const componentSlots = thaumcraftInfusionComponentSlots((rawRecipe.components ?? []).length);
    (rawRecipe.components ?? []).forEach((entry, index) =>
      addInput(entry, componentSlots[index], index + 1),
    );
    const aspectSlots = thaumcraftInfusionAspectSlots((rawRecipe.aspects ?? []).length);
    (rawRecipe.aspects ?? []).forEach((entry, index) => addInput(entry, aspectSlots[index], index));
  } else if (type === "crucible") {
    addInput(rawRecipe.catalyst ?? rawRecipe.centralInput, { x: 60, y: 34 }, 0);
    const aspectSlots = thaumcraftCrucibleAspectSlots((rawRecipe.aspects ?? []).length);
    (rawRecipe.aspects ?? []).forEach((entry, index) => addInput(entry, aspectSlots[index], index));
  } else if (type === "arcane") {
    const componentSlots = thaumcraftArcaneComponentSlots();
    const rawInputs = [
      rawRecipe.centralInput,
      rawRecipe.catalyst,
      ...(rawRecipe.components ?? []),
    ].filter(Boolean);
    rawInputs.forEach((entry, index) => addInput(entry, componentSlots[index], index));
    const aspectSlots = thaumcraftArcaneAspectSlots((rawRecipe.aspects ?? []).length);
    (rawRecipe.aspects ?? []).forEach((entry, index) => addInput(entry, aspectSlots[index], index));
  } else {
    [rawRecipe.centralInput, rawRecipe.catalyst, ...(rawRecipe.components ?? [])].forEach(
      (entry, index) => addInput(entry, compactCraftingInputPositions(6)[index], index),
    );
    (rawRecipe.aspects ?? []).forEach((entry, index) =>
      addInput(
        entry,
        thaumcraftAspectSlots((rawRecipe.aspects ?? []).length, 16, 62)[index],
        index,
      ),
    );
  }

  return {
    output,
    outputs: output ? [output] : [],
    inputs,
    nei:
      slots.length > 0
        ? {
            slots,
            progressBars,
          }
        : undefined,
  };
}

function normalizeExportedNeiLayout(rawLayout) {
  if (!rawLayout || typeof rawLayout !== "object" || !Array.isArray(rawLayout.slots)) {
    return undefined;
  }

  const inputs = [];
  const outputs = [];
  const slots = [];
  for (const rawSlot of rawLayout.slots) {
    const side = rawSlot?.side === "output" ? "output" : "input";
    const slot = {
      x: positiveInt(rawSlot?.x, 0),
      y: positiveInt(rawSlot?.y, 0),
    };
    const resource = resourceAmount(rawSlot?.resource, { neiSlot: slot });
    if (!resource) {
      continue;
    }
    const slotIndex = positiveInt(
      rawSlot?.slotIndex,
      side === "output" ? outputs.length : inputs.length,
    );
    slots.push({ side, kind: resource.kind, slotIndex, x: slot.x, y: slot.y });
    if (side === "output") {
      outputs.push(resource);
    } else {
      inputs.push(resource);
    }
  }

  if (outputs.length === 0) {
    return undefined;
  }

  const canvas =
    rawLayout.canvas && typeof rawLayout.canvas === "object"
      ? {
          width: positiveInt(rawLayout.canvas.width, 170),
          height: positiveInt(rawLayout.canvas.height, 82),
        }
      : undefined;

  return {
    output: outputs[0],
    inputs,
    nei: {
      source: text(rawLayout.source, "gtnh-nei-handler"),
      handlerClass: text(rawLayout.handlerClass, undefined),
      backgroundImage: text(rawLayout.backgroundImage, undefined),
      canvas,
      slots,
      progressBars: [],
    },
  };
}

function thaumcraftInfusionComponentSlots(count) {
  if (count <= 0) {
    return [];
  }
  const step = 360 / count;
  return Array.from({ length: count }, (_, index) => {
    const angle = (-90 + step * index) * (Math.PI / 180);
    return {
      x: 75 + Math.trunc(Math.cos(angle) * 40),
      y: 59 + Math.trunc(Math.sin(angle) * 40),
    };
  });
}

function thaumcraftInfusionAspectSlots(count) {
  const perRow = 9;
  const rows = Math.floor(count / perRow);
  const centerOffset = (5 - (count % perRow)) * 10;
  const baseX = 35;
  const baseY = 114 - 10 * rows;
  return Array.from({ length: count }, (_, index) => {
    const wrap = Math.floor(index / perRow) >= rows && (rows > 1 || count < perRow) ? 1 : 0;
    return {
      x: baseX + (index % perRow) * 20 + centerOffset * wrap,
      y: baseY + Math.floor(index / perRow) * 20,
    };
  });
}

function thaumcraftCrucibleAspectSlots(count) {
  const rows = Math.floor((count - 1) / 3);
  const centerOffset = (3 - (count % 3)) * 10;
  const baseX = 51;
  const baseY = 79 - 10 * rows;
  return Array.from({ length: count }, (_, index) => {
    const wrap = Math.floor(index / 3) >= rows && (rows > 1 || count < 3) ? 1 : 0;
    return {
      x: baseX + (index % 3) * 20 + centerOffset * wrap,
      y: baseY + Math.floor(index / 3) * 20,
    };
  });
}

function thaumcraftArcaneComponentSlots() {
  return [
    { x: 48, y: 33 },
    { x: 75, y: 33 },
    { x: 103, y: 33 },
    { x: 49, y: 60 },
    { x: 76, y: 60 },
    { x: 103, y: 60 },
    { x: 49, y: 87 },
    { x: 76, y: 87 },
    { x: 103, y: 87 },
  ];
}

function thaumcraftArcaneAspectSlots(count) {
  return Array.from({ length: count }, (_, index) => ({
    x: 42 + 18 * index + (5 - count) * 8,
    y: 115,
  }));
}

function thaumcraftAspectSlots(count, x, y) {
  return Array.from({ length: count }, (_, index) => ({
    x: x + (index % 6) * 18,
    y: y + Math.floor(index / 6) * 18,
  }));
}

function normalizeForestryBees(domain) {
  const machineType = "Bee Produce";
  for (const species of domain?.species ?? []) {
    const outputs = [
      ...(species.products ?? []).map((entry) => beeProductOutput(entry)),
      ...(species.specialty ?? []).map((entry) => beeProductOutput(entry, true)),
    ].filter(Boolean);
    if (outputs.length === 0) {
      continue;
    }
    const input = beeSpeciesInput(species);
    const durationTicks = positiveInt(species.cycleTicks, 550);
    recipeMaps.add(machineType);
    setRecipeMapIcon(
      machineType,
      species.input ?? species.products?.[0]?.resource ?? species.specialty?.[0]?.resource,
    );
    addRecipe({
      id: recipeId("forestry-bee", species.uid ?? species.name ?? hashRecipe(species)),
      name: `${text(species.name, species.uid ?? "Bee")} Produce`,
      kind: "bee_produce",
      category: "forestry-bee",
      machineType,
      minimumTier: "NONE",
      durationTicks,
      eut: 0,
      inputs: input ? [input] : [],
      outputs,
      runtimeCalculation: {
        sourceKind: "passive-bee",
        sourceClass: species.className,
        recipeMap: machineType,
        status: "computed",
        oracleEligible: true,
        strict: true,
        generatedAt,
        variants: [
          {
            id: "base-apiary",
            label: "Forestry species base cycle",
            machineConfigTiers: {
              beeEnvironment: "preferred",
              beeFrameSlot1: "none",
              beeFrameSlot2: "none",
              beeFrameSlot3: "none",
            },
            durationTicks,
            eut: 0,
            outputs: runtimeResources(outputs),
          },
        ],
        warnings: [
          "Species products and chances come from the live Forestry allele API. Housing, frame, industrial, and mega modifiers require their matching oracle variant before being used as exact variants.",
        ],
      },
      notes: "Exported by the GTNH calculation oracle from Forestry bee allele species.",
      source: {
        datasetVersionId,
        recipeMap: machineType,
        exporter: "gtnh-oracle",
        rawRecipeId: species.uid ?? species.name,
      },
      metadata: {
        speciesUid: species.uid,
        speciesName: species.name,
        condition: species.humidity || species.temperature ? "Preferred environment" : undefined,
      },
    });
  }
}

function normalizeIc2Crops(domain) {
  const machineType = "IC2 Crop";
  const cropsNhLoaded = (raw.loadedMods ?? []).some(
    (modId) => String(modId).toLowerCase() === "cropsnh",
  );
  const cropsNhAdapter = (raw.adapters ?? []).find(
    (adapter) => adapter.id === "cropsnh-crop-cards",
  );
  if (
    cropsNhLoaded &&
    (cropsNhAdapter?.status !== "computed" || !(cropsNhAdapter.recipeCount > 0))
  ) {
    normalizationFailures.push({
      adapter: "cropsnh-crops",
      id: "cropsnh-live-registry",
      reason:
        "CropsNH is loaded, but the authoritative CropsNH crop registry was not exported successfully.",
    });
  }
  for (const crop of domain?.crops ?? []) {
    const baseVariant =
      (crop.variants ?? []).find((variant) => variant.id === "23-31-0") ??
      (crop.variants ?? []).find((variant) => variant.id === "23-31-1") ??
      (crop.variants ?? []).find((variant) => variant.id === "31-31-31") ??
      (crop.variants ?? [])[0] ??
      crop;
    const outputs = cropOutputs(baseVariant.drops ?? crop.drops);
    if (outputs.length === 0) {
      if (crop.harvestable === false) {
        continue;
      }
      normalizationFailures.push({
        adapter: "ic2-crops",
        id: `${crop.owner ?? "unknown"}:${crop.id ?? crop.name ?? "unknown"}`,
        reason: "Crop has no exported drop for its base runtime variant.",
      });
      continue;
    }
    const input = cropSeedInput(crop);
    if (!input) {
      normalizationFailures.push({
        adapter: "ic2-crops",
        id: `${crop.owner ?? "unknown"}:${crop.id ?? crop.name ?? "unknown"}`,
        reason: "Crop has no real seed ItemStack; synthetic seed resources are not allowed.",
      });
      continue;
    }
    const durationTicks = positiveInt(baseVariant.durationTicks ?? crop.durationTicks, 200);
    const cropName = cropDisplayName(crop, input);

    recipeMaps.add(machineType);
    setRecipeMapIcon(
      machineType,
      crop.seed ?? crop.displayItem ?? baseVariant.drops?.[0]?.resource,
    );
    addRecipe({
      id: recipeId("ic2-crop", crop.owner, crop.id ?? crop.name ?? hashRecipe(crop)),
      name: `${machineType}: ${cropName}`,
      kind: "crop_produce",
      category: "ic2-crop",
      machineType,
      minimumTier: "NONE",
      durationTicks,
      eut: 0,
      inputs: [input],
      outputs,
      runtimeCalculation: {
        sourceKind: "passive-crop",
        sourceClass: crop.className,
        recipeMap: machineType,
        status: "computed",
        oracleEligible: true,
        strict: true,
        generatedAt,
        variants: cropRuntimeVariants(crop, outputs, durationTicks),
        warnings: [
          "Crop drops and durations are calculated by live IC2/CropsNH crop-card methods. Only the exported stat presets are selectable; no client-side crop formula is applied.",
          "Conditional crops assume their required supporting block and environment are satisfied by the farm.",
        ],
      },
      notes: [
        "Exported by the GTNH calculation oracle from IC2/CropsNH crop-card APIs.",
        crop.owner ? `Owner: ${crop.owner}` : undefined,
        crop.tier !== undefined ? `Tier: ${crop.tier}` : undefined,
      ]
        .filter(Boolean)
        .join(" "),
      source: {
        datasetVersionId,
        recipeMap: machineType,
        exporter: "gtnh-oracle",
        rawRecipeId: `${crop.owner ?? "unknown"}:${crop.id ?? crop.name ?? hashRecipe(crop)}`,
      },
      metadata: {
        cropOwner: crop.owner,
        cropId: crop.id,
        cropTier: crop.tier,
      },
      nei: {
        slots: [
          { side: "input", kind: "item", slotIndex: 0, x: 34, y: 35 },
          ...outputs.map((output, index) => ({
            side: "output",
            kind: output.kind,
            slotIndex: index,
            x: 124 + index * 18,
            y: 35,
          })),
        ],
        progressBars: [
          { x: 78, y: 35, width: 24, height: 17, direction: "right", texture: "arrow" },
        ],
      },
    });
  }
}

function beeSpeciesInput(species) {
  const icon = resourceAmount(species.input, { consumed: false, defaultAmount: 1 });
  const uid = text(species.uid, species.name ?? hashRecipe(species));
  return removeUndefined({
    kind: "item",
    id: `factoryflow:bee_species:${slug(uid)}`,
    amount: 1,
    displayName: `${text(species.name, uid)} Bee`,
    iconPath: icon?.iconPath,
    dominantColor: icon?.dominantColor,
    modId: icon?.modId ?? "Forestry",
    consumed: false,
    neiSlot: { x: 48, y: 35 },
  });
}

function cropSeedInput(crop) {
  const seed = resourceAmount(crop.seed, {
    consumed: false,
    defaultAmount: 1,
    neiSlot: { x: 34, y: 35 },
  });
  if (!seed) {
    return undefined;
  }
  const owner = text(crop.owner, "unknown");
  const name = text(crop.name, crop.id ?? hashRecipe(crop));
  const displayName = looksLikeTranslationKey(seed.displayName)
    ? `${humanizeCropIdentifier(crop.id ?? crop.name)} Seeds`
    : seed.displayName;
  return removeUndefined({
    ...seed,
    amount: 1,
    displayName,
    tooltip: [
      ...(seed.tooltip ?? []),
      "IC2 crop seed",
      `Owner: ${owner}`,
      `Crop: ${name}`,
      crop.className,
    ].filter(Boolean),
    consumed: false,
    neiSlot: { x: 34, y: 35 },
  });
}

function cropDisplayName(crop, seed) {
  const rawName = text(crop.name, crop.id ?? "Crop");
  if (!looksLikeTranslationKey(rawName)) {
    return rawName;
  }
  const seedName = text(seed.displayName, rawName).replace(/\s+seeds?$/i, "");
  return looksLikeTranslationKey(seedName) ? humanizeCropIdentifier(crop.id ?? rawName) : seedName;
}

function looksLikeTranslationKey(value) {
  const label = text(value, "");
  return /^[a-z0-9_.:-]+(?:\s+seeds?)?$/i.test(label) && /[.:_]/.test(label);
}

function humanizeCropIdentifier(value) {
  const segment = text(value, "Crop").split(/[.:/]/).filter(Boolean).at(-1) ?? "Crop";
  return segment
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cropOutputs(rawDrops) {
  return (rawDrops ?? [])
    .map((entry, index) =>
      resourceAmount(entry.resource, {
        chance: normalizeChance(entry.chance),
        neiSlot: { x: 124 + index * 18, y: 35 },
      }),
    )
    .filter(Boolean);
}

function cropRuntimeVariants(crop, fallbackOutputs, fallbackDurationTicks) {
  const variants = (crop.variants ?? [])
    .map((variant) => {
      const outputs = cropOutputs(variant.drops);
      if (outputs.length === 0) {
        return undefined;
      }
      const seed = resourceAmount(variant.seed, {
        consumed: false,
        defaultAmount: 1,
      });
      if (seed) {
        addResource(seed);
      }
      return {
        id: text(variant.id, "base"),
        label: text(variant.label, variant.id ?? "Crop stats"),
        machineConfigTiers: {
          cropStats: text(variant.id, "23-31-0"),
        },
        durationTicks: positiveInt(variant.durationTicks, fallbackDurationTicks),
        eut: 0,
        inputs: seed ? runtimeResources([seed]) : undefined,
        outputs: runtimeResources(outputs),
      };
    })
    .filter(Boolean);

  if (variants.length > 0) {
    return variants;
  }
  return [
    {
      id: "base",
      label: "Base crop-card output",
      durationTicks: fallbackDurationTicks,
      eut: 0,
      outputs: runtimeResources(fallbackOutputs),
    },
  ];
}

function beeProductOutput(entry, specialty = false) {
  const output = resourceAmount(entry.resource, { chance: normalizeChance(entry.chance) });
  if (output && specialty) {
    output.byproduct = true;
  }
  return output;
}

function setRecipeMapIcon(machineType, rawIcon) {
  const icon = resourceAmount(rawIcon);
  if (!icon) {
    return;
  }
  addResource(icon);
  if (!recipeMapIcons.has(machineType)) {
    recipeMapIcons.set(machineType, icon);
  }
}

function craftingInputGrid(rawRecipe) {
  if (rawRecipe.type === "shaped") {
    return { width: 3, height: 3 };
  }
  const count = Math.max(1, (rawRecipe.inputs ?? []).length);
  if (count <= 1) return { width: 1, height: 1 };
  if (count <= 4) return { width: 2, height: 2 };
  return { width: 3, height: 2 };
}

function craftingInputNeiSlot(rawRecipe, slotIndex) {
  const index = Math.max(0, Number(slotIndex) || 0);
  if (rawRecipe.type === "shaped") {
    const width = Math.max(1, positiveInt(rawRecipe.width, 3));
    return {
      x: 25 + (index % width) * 18,
      y: 8 + Math.floor(index / width) * 18,
    };
  }
  return compactCraftingInputPositions((rawRecipe.inputs ?? []).length)[index];
}

function craftingNeiSlots(rawRecipe, inputCount) {
  const inputSlots =
    rawRecipe.type === "shaped"
      ? Array.from({ length: 9 }, (_, index) => ({
          side: "input",
          kind: "item",
          slotIndex: index,
          x: 25 + (index % 3) * 18,
          y: 8 + Math.floor(index / 3) * 18,
        }))
      : compactCraftingInputPositions(inputCount).map((slot, index) => ({
          side: "input",
          kind: "item",
          slotIndex: index,
          x: slot.x,
          y: slot.y,
        }));
  return [...inputSlots, { side: "output", kind: "item", slotIndex: 0, x: 124, y: 26 }];
}

function compactCraftingInputPositions(count) {
  switch (Math.max(0, count)) {
    case 0:
      return [];
    case 1:
      return [{ x: 61, y: 26 }];
    case 2:
      return [
        { x: 52, y: 26 },
        { x: 70, y: 26 },
      ];
    case 3:
      return [
        { x: 43, y: 26 },
        { x: 61, y: 26 },
        { x: 79, y: 26 },
      ];
    case 4:
      return [
        { x: 52, y: 17 },
        { x: 70, y: 17 },
        { x: 52, y: 35 },
        { x: 70, y: 35 },
      ];
    default:
      return Array.from({ length: count }, (_, index) => ({
        x: 43 + (index % 3) * 18,
        y: 17 + Math.floor(index / 3) * 18,
      }));
  }
}

function machineConfigControlsForOracleRecipe(machineType, specialValue, extraControls = []) {
  const controls = [...(extraControls ?? [])];
  const normalized = normalizeLabel(machineType);

  if (isBlastFurnaceRecipeMap(normalized)) {
    const minimum =
      Number.isFinite(Number(specialValue)) && Number(specialValue) > 0
        ? coilTierForHeat(Number(specialValue))
        : heatingCoilTiers[0];
    controls.push(
      heatingCoilControl({
        minimumKey: minimum.key,
        defaultKey: minimum.key,
        tooltip: (tier) => [`Heat capacity: ${tier.heat} K`],
      }),
    );
  }

  if (normalized === "pyrolyse oven") {
    controls.push(
      heatingCoilControl({
        tooltip: (tier, index) => [
          `Duration multiplier: ${formatTooltipMultiplier(2 / (1 + index))}x`,
          "EU/t is not affected by coil tier",
        ],
        effect: (_tier, index) => ({ durationMultiplier: 2 / (1 + index) }),
      }),
    );
  }

  if (normalized === "oil cracker") {
    controls.push(
      heatingCoilControl({
        tooltip: (_tier, index) => [
          `EU usage: ${formatTooltipPercent(1 - Math.min(0.1 * (index + 1), 0.5))}`,
        ],
        effect: (_tier, index) => ({ eutMultiplier: 1 - Math.min(0.1 * (index + 1), 0.5) }),
      }),
    );
  }

  if (normalized === "large chemical reactor") {
    controls.push(
      heatingCoilControl({
        tooltip: () => ["Required structure coil", "No runtime speed or EU/t effect"],
      }),
    );
  }

  if (normalized === "coke oven" || normalized === "industrial coke oven") {
    controls.push(
      heatingCoilControl({
        tooltip: (_tier, index) => [`EU usage: ${formatTooltipPercent(Math.pow(0.98, index + 1))}`],
        effect: (_tier, index) => ({ eutMultiplier: Math.pow(0.98, index + 1) }),
      }),
    );
    controls.push({
      id: "cokeOvenCasing",
      label: "Coke Oven Casing",
      minimumKey: "heat_resistant",
      defaultKey: "heat_resistant",
      tiers: [
        {
          key: "heat_resistant",
          label: "Heat Resistant",
          parallelMultiplier: 16,
          resource: machineConfigResource(
            "factoryflow:machine_config/heat_resistant_coke_oven_casing",
            "Heat Resistant Coke Oven Casing",
            ["Coke Oven casing tier", "Parallels: 16"],
          ),
        },
        {
          key: "heat_proof",
          label: "Heat Proof",
          parallelMultiplier: 32,
          resource: machineConfigResource(
            "factoryflow:machine_config/heat_proof_coke_oven_casing",
            "Heat Proof Coke Oven Casing",
            ["Coke Oven casing tier", "Parallels: 32"],
          ),
        },
      ],
    });
  }

  return mergeMachineConfigControls(controls);
}

function machineConfigControlsFromCatalysts(catalysts) {
  const lines = (catalysts ?? [])
    .flatMap((catalyst) => catalyst?.resource?.tooltip ?? [])
    .map((line) => text(line, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const controls = [];
  for (const line of lines) {
    const multiplicativePerTier =
      /(?:^|\b)(\d+(?:[.,]\d+)?)x\s+Parallels?\s+per\s+(.+?)\s+Tier\b/i.exec(line);
    if (multiplicativePerTier) {
      const factor = parseTooltipNumber(multiplicativePerTier[1]);
      const tierControl = tieredEffectControlFromSubject(multiplicativePerTier[2], line, {
        effectLabel: "Parallels",
        effect: (tier, index) => ({
          parallelMultiplier: Math.pow(factor, tierOrdinal(tier, index)),
        }),
        keep: (effect) => effect.parallelMultiplier > 1,
      });
      if (tierControl) controls.push(tierControl);
      continue;
    }

    const perTier = /(?:^|\b)(\d+)\s+Parallels?\s+per\s+(.+?)\s+Tier\b/i.exec(line);
    if (perTier) {
      const factor = Number.parseInt(perTier[1], 10);
      const tierControl = tieredEffectControlFromSubject(perTier[2], line, {
        effectLabel: "Parallels",
        effect: (tier, index) => ({ parallelMultiplier: factor * tierOrdinal(tier, index) }),
        keep: (effect) => effect.parallelMultiplier > 1,
      });
      if (tierControl) controls.push(tierControl);
      continue;
    }

    const speedPerTier = /(?:^|\b)\+?(\d+(?:[.,]\d+)?%)\s+Speed\s+per\s+(.+?)\s+Tier\b/i.exec(line);
    if (speedPerTier) {
      const factor = parseTooltipFactor(speedPerTier[1]);
      const tierControl = tieredEffectControlFromSubject(speedPerTier[2], line, {
        effectLabel: "Speed",
        effect: (tier, index) => ({
          durationMultiplier: reciprocal(1 + factor * tierOrdinal(tier, index)),
        }),
        keep: (effect) => effect.durationMultiplier > 0 && effect.durationMultiplier < 1,
      });
      if (tierControl) controls.push(tierControl);
      continue;
    }

    const euUsagePerTier =
      /(?:^|\b)([+-]?\d+(?:[.,]\d+)?%)\s+EU\s+Usage\s+per\s+(.+?)\s+Tier\b/i.exec(line);
    if (euUsagePerTier) {
      const factor = parseTooltipFactor(euUsagePerTier[1]);
      const tierControl = tieredEffectControlFromSubject(euUsagePerTier[2], line, {
        effectLabel: "EU usage",
        effect: (tier, index) => ({
          eutMultiplier: Math.max(0.01, 1 + factor * tierOrdinal(tier, index)),
        }),
        keep: (effect) => effect.eutMultiplier > 0 && effect.eutMultiplier !== 1,
      });
      if (tierControl) controls.push(tierControl);
      continue;
    }

    const staticParallel = /(?:^|\b)(\d+)\s+Parallels?\s*$/i.exec(line);
    if (staticParallel) {
      const parallels = Number.parseInt(staticParallel[1], 10);
      if (parallels > 1) {
        controls.push({
          id: "machineParallel",
          label: "Parallel",
          minimumKey: `fixed-${parallels}`,
          defaultKey: `fixed-${parallels}`,
          tiers: [
            {
              key: `fixed-${parallels}`,
              label: `${parallels} Parallels`,
              parallelMultiplier: parallels,
              resource: machineConfigResource(
                `factoryflow:machine_config/fixed-${parallels}`,
                `${parallels} Parallels`,
                ["Imported from machine catalyst tooltip", line],
              ),
            },
          ],
        });
      }
    }
  }

  return mergeMachineConfigControls(controls) ?? [];
}

function heatingCoilControl({
  minimumKey = "cupronickel",
  defaultKey = minimumKey,
  tooltip = () => [],
  effect = () => ({}),
} = {}) {
  return {
    id: "heatingCoil",
    label: "Heating Coil",
    minimumKey,
    defaultKey,
    tiers: heatingCoilTiers.map((tier, index) => ({
      key: tier.key,
      label: tier.label,
      heat: tier.heat,
      ...effect(tier, index),
      resource: machineConfigResource(tier.blockId, `${tier.label} Coil Block`, [
        "Heating coil tier",
        ...tooltip(tier, index),
      ]),
    })),
  };
}

function addRecipe(recipe) {
  const signature = recipeSignature(recipe);
  if (recipeSignatures.has(signature)) {
    return;
  }
  recipeSignatures.add(signature);
  const stableId = recipeId(recipe.kind ?? "recipe", hashRecipe(signature));
  for (const resource of [
    ...recipe.inputs,
    ...recipe.outputs,
    ...machineConfigResources(recipe.machineConfigControls),
    ...machineHandlerConfigResources(recipe.machineHandlers),
  ]) {
    addResource(resource);
  }
  recipes.push({
    ...recipe,
    id: stableId,
    inputs: recipe.inputs.map(compactRecipeResource),
    outputs: recipe.outputs.map(compactRecipeResource),
  });
}

function compactRecipeResource(resource) {
  const compact = { ...resource };
  delete compact.alternatives;
  return compact;
}

function resourceAmount(rawResource, options = {}) {
  if (!rawResource || typeof rawResource !== "object") {
    return undefined;
  }

  if (rawResource.kind === "oreDictionary") {
    return oreDictionaryResource(rawResource);
  }
  if (rawResource.kind === "choice") {
    return choiceResource(rawResource);
  }
  if (rawResource.kind === "text") {
    return undefined;
  }
  if (!["item", "fluid", "aspect"].includes(rawResource.kind)) {
    return undefined;
  }

  const amount = positiveNumber(rawResource.amount, options.defaultAmount ?? 1);
  const canonicalId = canonicalResourceId(rawResource.kind, text(rawResource.id, ""));
  if (!canonicalId || !(amount > 0)) {
    return undefined;
  }
  const id =
    rawResource.kind === "item" && rawResource.nbt
      ? `${canonicalId}#nbt-${hashRecipe(String(rawResource.nbt))}`
      : canonicalId;
  const iconPath = renderedIconPath(rawResource.icon) ?? text(rawResource.iconPath, undefined);
  const tooltip = [
    ...(normalizeStringArray(rawResource.tooltip) ?? []),
    rawResource.nbt ? `NBT: ${rawResource.nbt}` : undefined,
  ].filter(Boolean);
  const resource = removeUndefined({
    kind: rawResource.kind,
    id,
    amount,
    displayName: text(rawResource.displayName, id),
    iconPath,
    dominantColor:
      renderedIconColor(rawResource.icon) ?? text(rawResource.dominantColor, undefined),
    modId: rawResource.modId,
    tooltip: tooltip.length > 0 ? tooltip : undefined,
    consumed: options.consumed === false || rawResource.consumed === false ? false : undefined,
    chance: normalizeChance(options.chance ?? rawResource.chance),
    neiSlot: options.neiSlot,
  });
  return resource;
}

function oreDictionaryResource(rawResource) {
  const names = (rawResource.names ?? []).map((entry) => text(entry, "")).filter(Boolean);
  const alternatives = [
    ...(rawResource.alternatives ?? []).map((entry) => resourceAmount(entry)).filter(Boolean),
    ...names.flatMap((name) => oreDictionaryAlternativesByName.get(name) ?? []),
  ];
  if (names.length === 0 && alternatives.length === 0) {
    return undefined;
  }

  const primaryName = names[0] ?? `choice-${hashRecipe(alternatives.map((entry) => entry.id))}`;
  const id = `oredict:${primaryName}`;
  for (const name of names) {
    oreDictionary[name] = [
      ...new Set([...(oreDictionary[name] ?? []), ...alternatives.map((entry) => entry.id)]),
    ].sort();
  }
  return {
    kind: "item",
    id,
    amount: 1,
    displayName: names.length > 0 ? `Ore Dictionary: ${names.join(", ")}` : "Ore Dictionary Choice",
    alternatives: alternatives.map(resourceAlternative),
    tooltip: [
      names.length > 0 ? `Ore dictionary: ${names.join(", ")}` : undefined,
      alternatives.length > 0
        ? `Accepts: ${alternatives
            .slice(0, 12)
            .map(resourceLabel)
            .join(", ")}${alternatives.length > 12 ? `, +${alternatives.length - 12} more` : ""}`
        : undefined,
    ].filter(Boolean),
    oreDictionary: names.length > 0 ? names : undefined,
  };
}

function choiceResource(rawResource) {
  const alternatives = (rawResource.alternatives ?? [])
    .map((entry) => resourceAmount(entry))
    .filter(Boolean);
  if (alternatives.length === 0) {
    return undefined;
  }

  const id = text(rawResource.id, `choice:${hashRecipe(alternatives.map((entry) => entry.id))}`);
  return {
    kind: "item",
    id,
    amount: positiveNumber(rawResource.amount, 1),
    displayName: text(rawResource.displayName, "Item Choice"),
    alternatives: alternatives.map(resourceAlternative),
    tooltip: [
      `Accepts: ${alternatives
        .slice(0, 12)
        .map(resourceLabel)
        .join(", ")}${alternatives.length > 12 ? `, +${alternatives.length - 12} more` : ""}`,
    ],
  };
}

function addResource(resource) {
  if (!resource?.kind || !resource?.id) {
    return;
  }
  const key = `${resource.kind}:${resource.id}`;
  const existing = resources.get(key);
  if (!existing) {
    resources.set(key, resourceCatalogEntry(resource));
    return;
  }
  if (!existing.iconPath && resource.iconPath) {
    existing.iconPath = resource.iconPath;
  }
  if (!existing.dominantColor && resource.dominantColor) {
    existing.dominantColor = resource.dominantColor;
  }
}

function resourceCatalogEntry(resource) {
  return removeUndefined({
    id: resource.id,
    kind: resource.kind,
    displayName: resource.displayName ?? resource.id,
    iconPath: resource.iconPath,
    dominantColor: resource.dominantColor,
    modId: resource.modId,
    tooltip: resource.tooltip,
    oreDictionary: resource.oreDictionary,
    alternatives: resource.alternatives,
  });
}

function resourceAlternative(resource) {
  return removeUndefined({
    kind: resource.kind,
    id: resource.id,
    displayName: resource.displayName,
    iconPath: resource.iconPath,
    dominantColor: resource.dominantColor,
    modId: resource.modId,
    tooltip: resource.tooltip,
    amount: resource.amount,
  });
}

function machineConfigResources(controls) {
  return (controls ?? []).flatMap((control) =>
    (control.tiers ?? []).map((tier) => tier.resource).filter(Boolean),
  );
}

function machineHandlerConfigResources(handlers) {
  return (handlers ?? []).flatMap((handler) =>
    machineConfigResources(handler.machineConfigControls),
  );
}

function mergeMachineConfigControls(controls) {
  const byId = new Map();
  for (const control of (controls ?? []).filter(Boolean)) {
    const existing = byId.get(control.id);
    if (!existing) {
      byId.set(control.id, control);
      continue;
    }
    const tiersByKey = new Map((existing.tiers ?? []).map((tier) => [tier.key, tier]));
    for (const tier of control.tiers ?? []) {
      const current = tiersByKey.get(tier.key);
      tiersByKey.set(tier.key, current ? mergeMachineConfigTierOption(current, tier) : tier);
    }
    byId.set(control.id, {
      ...existing,
      minimumKey: existing.minimumKey ?? control.minimumKey,
      defaultKey: existing.defaultKey ?? control.defaultKey,
      tiers: [...tiersByKey.values()],
    });
  }
  const merged = [...byId.values()];
  return merged.length > 0 ? merged : undefined;
}

function mergeMachineConfigTierOption(existing, incoming) {
  return {
    ...existing,
    ...incoming,
    label: existing.label ?? incoming.label,
    resource: mergeMachineConfigTierResource(existing.resource, incoming.resource),
  };
}

function mergeMachineConfigTierResource(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  return {
    ...existing,
    ...incoming,
    id: existing.id ?? incoming.id,
    displayName: existing.displayName ?? incoming.displayName,
    tooltip: uniqueStrings([...(existing.tooltip ?? []), ...(incoming.tooltip ?? [])]),
  };
}

function tieredEffectControlFromSubject(subject, line, { effectLabel, effect, keep }) {
  const definition = machineConfigTierDefinitionForSubject(subject);
  if (!definition) {
    return undefined;
  }

  const options = definition.tiers
    .map((tier, index) => {
      const effectFields = effect(tier, index);
      if (!isValidMachineConfigEffect(effectFields) || (keep && !keep(effectFields))) {
        return undefined;
      }
      return {
        key: tier.key,
        label: tier.label,
        ...effectFields,
        resource: {
          ...tier.resource,
          tooltip: uniqueStrings([
            definition.tooltipPrefix,
            line,
            ...effectTooltipLines(effectLabel, effectFields),
            ...(tier.resource.tooltip ?? []),
          ]),
        },
      };
    })
    .filter(Boolean);

  if (options.length === 0) {
    return undefined;
  }

  return {
    id: definition.id,
    label: definition.label,
    minimumKey: options[0].key,
    defaultKey: options[0].key,
    tiers: options,
  };
}

function machineConfigTierDefinitionForSubject(subject) {
  const normalized = normalizeLabel(subject);
  if (normalized.includes("coil")) {
    return {
      id: "heatingCoil",
      label: "Heating Coil",
      tiers: heatingCoilTiers.map((tier) => ({
        key: tier.key,
        label: tier.label,
        resource: machineConfigResource(tier.blockId, `${tier.label} Coil Block`, [
          "Heating coil tier",
          `Heat capacity: ${tier.heat} K`,
        ]),
      })),
      tooltipPrefix: "Heating coil tier",
    };
  }
  if (normalized.includes("pipe casing")) {
    return {
      id: "pipeCasing",
      label: "Pipe Casing",
      tiers: pipeCasingTiers.map((tier) => ({
        key: tier.key,
        label: tier.label,
        resource: machineConfigResource(tier.blockId, `${tier.label} Pipe Casing`, [
          "Pipe casing tier",
        ]),
      })),
      tooltipPrefix: "Pipe casing tier",
    };
  }
  if (normalized.includes("solenoid")) {
    return {
      id: "solenoidCoil",
      label: "Solenoid",
      tiers: solenoidTiers.map((tier) => ({
        key: tier.key,
        label: tier.label,
        voltageTier: tier.voltageTier,
        resource: machineConfigResource(
          tier.blockId,
          `${tier.label} Solenoid Superconductor Coil`,
          ["Solenoid tier"],
        ),
      })),
      tooltipPrefix: "Solenoid tier",
    };
  }
  return undefined;
}

function isValidMachineConfigEffect(effect) {
  return (
    Number.isFinite(effect?.parallelMultiplier) ||
    Number.isFinite(effect?.durationMultiplier) ||
    Number.isFinite(effect?.eutMultiplier) ||
    Number.isFinite(effect?.outputMultiplier) ||
    Number.isFinite(effect?.heat)
  );
}

function effectTooltipLines(effectLabel, effect) {
  const lines = [];
  if (Number.isFinite(effect.parallelMultiplier)) {
    lines.push(`${effectLabel}: ${formatTooltipMultiplier(effect.parallelMultiplier)}x`);
  }
  if (Number.isFinite(effect.durationMultiplier)) {
    lines.push(
      `${effectLabel}: ${formatTooltipMultiplier(reciprocal(effect.durationMultiplier))}x`,
    );
  }
  if (Number.isFinite(effect.eutMultiplier)) {
    lines.push(`${effectLabel}: ${formatTooltipPercent(effect.eutMultiplier)}`);
  }
  if (Number.isFinite(effect.outputMultiplier)) {
    lines.push(`${effectLabel}: ${formatTooltipMultiplier(effect.outputMultiplier)}x`);
  }
  return lines;
}

function machineConfigResource(id, displayName, tooltip = []) {
  return {
    kind: "item",
    id,
    amount: 1,
    displayName,
    tooltip,
    consumed: false,
  };
}

function coilTierForHeat(heat) {
  return heatingCoilTiers.find((tier) => tier.heat >= heat) ?? heatingCoilTiers.at(-1);
}

function isBlastFurnaceRecipeMap(normalizedMachineType) {
  return (
    normalizedMachineType === "blast furnace" || normalizedMachineType === "electric blast furnace"
  );
}

function parseTooltipFactor(value) {
  const number = parseTooltipNumber(value);
  return String(value).trim().endsWith("%") ? number / 100 : number;
}

function parseTooltipNumber(value) {
  return Number.parseFloat(String(value).replace(",", ".").replace("%", ""));
}

function reciprocal(value) {
  return Number.isFinite(value) && value !== 0 ? 1 / value : Number.NaN;
}

function tierOrdinal(tier, index) {
  return Number.isFinite(tier.voltageTier) ? tier.voltageTier : index + 1;
}

function formatTooltipMultiplier(value) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function formatTooltipPercent(value) {
  return `${formatTooltipMultiplier(value * 100)}%`;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeRuntimeCalculation(rawRuntime, recipeMap, fallbackOutputs) {
  if (!rawRuntime || typeof rawRuntime !== "object") {
    return undefined;
  }
  const rawVariants = rawRuntime.compactVariants
    ? rawRuntime.compactVariants.map((variant) => compactRuntimeVariant(variant))
    : (rawRuntime.variants ?? []);
  const variants = rawVariants
    .map((variant, index) => normalizeRuntimeVariant(variant, index, fallbackOutputs))
    .filter(Boolean);
  return {
    sourceKind: text(rawRuntime.sourceKind, "gregtech-overclock-calculator"),
    sourceClass: rawRuntime.sourceClass,
    sourceVersion: rawRuntime.sourceVersion,
    recipeMap: text(rawRuntime.recipeMap, recipeMap),
    status: variants.length > 0 ? text(rawRuntime.status, "computed") : "missing",
    oracleEligible: rawRuntime.oracleEligible !== false,
    strict: rawRuntime.strict !== false,
    generatedAt: rawRuntime.generatedAt ?? generatedAt,
    variants,
    warnings: normalizeStringArray(rawRuntime.warnings),
  };
}

function compactRuntimeVariant(value) {
  if (!Array.isArray(value)) {
    return value;
  }
  const tierIndex = Number(value[0]);
  const tier = GT_VOLTAGE_NAMES[tierIndex] ?? `tier-${tierIndex}`;
  const profile = text(value[3], "");
  const configKey = text(value[4], "");
  const coil = configKey ? heatingCoilTiers.find((entry) => entry.key === configKey) : undefined;
  const variant = {
    id: `tier-${tier.toLowerCase()}`,
    label: tier,
    overclockTier: tier,
    durationTicks: value[1],
    eut: value[2],
    parallel: 1,
  };
  if (!profile) {
    return variant;
  }

  if (profile === "ebf-heat") {
    return {
      ...variant,
      id: `tier-${tier.toLowerCase()}-coil-${configKey}`,
      label: `${tier} / ${coil?.label ?? configKey}`,
      coilTier: configKey,
      notes: "GTNH EBF heat overclock and heat discount profile.",
    };
  }
  if (profile === "pyrolyse-coil") {
    return {
      ...variant,
      id: `tier-${tier.toLowerCase()}-coil-${configKey}`,
      label: `${tier} / ${coil?.label ?? configKey}`,
      coilTier: configKey,
      notes: "GTNH Pyrolyse Oven coil speed profile.",
    };
  }
  if (profile === "oil-cracker-coil") {
    return {
      ...variant,
      id: `tier-${tier.toLowerCase()}-coil-${configKey}`,
      label: `${tier} / ${coil?.label ?? configKey}`,
      coilTier: configKey,
      notes: "GTNH Oil Cracker coil EU discount profile.",
    };
  }
  if (profile === "perfect-oc") {
    return {
      ...variant,
      id: `tier-${tier.toLowerCase()}-perfect-oc`,
      label: `${tier} Perfect OC`,
      notes: "GTNH perfect overclock profile.",
    };
  }
  return {
    ...variant,
    id: `tier-${tier.toLowerCase()}-${slug(profile)}${configKey ? `-${slug(configKey)}` : ""}`,
    label: `${tier} ${profile}${configKey ? ` ${configKey}` : ""}`,
    notes: `GTNH runtime profile: ${profile}${configKey ? `/${configKey}` : ""}.`,
  };
}

function normalizeRuntimeVariant(variant, index, fallbackOutputs) {
  const durationTicks = positiveInt(variant?.durationTicks, 0);
  const eut = Number(variant?.eut);
  if (!(durationTicks > 0) || !Number.isFinite(eut) || eut < 0) {
    return undefined;
  }
  const outputs = (variant.outputs ?? []).map((entry) => resourceAmount(entry)).filter(Boolean);
  return removeUndefined({
    id: text(variant.id, `variant-${index}`),
    label: variant.label,
    machineHandlerId: variant.machineHandlerId,
    overclockTier: variant.overclockTier,
    coilTier: variant.coilTier,
    machineConfigTiers: variant.machineConfigTiers,
    durationTicks,
    eut,
    parallel: positiveNumber(variant.parallel, undefined),
    inputs: (variant.inputs ?? [])
      .map((entry) => runtimeResource(resourceAmount(entry)))
      .filter(Boolean),
    outputs: runtimeResources(outputs.length > 0 ? outputs : fallbackOutputs),
    notes: variant.notes,
  });
}

function runtimeResources(values) {
  return (values ?? []).map(runtimeResource).filter(Boolean);
}

function runtimeResource(resource) {
  if (!resource) {
    return undefined;
  }
  return removeUndefined({
    kind: resource.kind,
    id: resource.id,
    amount: Number(resource.amount),
    chance: normalizeChance(resource.chance),
  });
}

async function writeOracleReport(dataset) {
  const runtimeRecipes = dataset.recipes.filter(
    (recipe) => recipe.runtimeCalculation?.oracleEligible,
  );
  const computedRuntimeRecipes = runtimeRecipes.filter(
    (recipe) =>
      recipe.runtimeCalculation?.status === "computed" &&
      recipe.runtimeCalculation?.variants?.length > 0,
  );
  const runtimeFailures = runtimeRecipes
    .filter((recipe) => !computedRuntimeRecipes.includes(recipe))
    .map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      machineType: recipe.machineType,
      status: recipe.runtimeCalculation?.status ?? "missing",
    }));
  const adapterWarnings = (raw.adapters ?? [])
    .filter((adapter) => adapter.status === "partial" || adapter.status === "missing")
    .map((adapter) => ({
      id: adapter.id,
      status: adapter.status,
      detected: adapter.detected,
      warnings: adapter.warnings,
    }));
  const failures = [...runtimeFailures, ...normalizationFailures];
  const report = {
    schemaVersion: 1,
    datasetVersionId,
    generatedAt,
    strict: oracleStrict,
    adapterCount: raw.adapters?.length ?? 0,
    adapters: raw.adapters ?? [],
    recipeCount: dataset.recipes.length,
    runtimeEligibleRecipeCount: runtimeRecipes.length,
    runtimeComputedRecipeCount: computedRuntimeRecipes.length,
    runtimeMissingRecipeCount: runtimeFailures.length,
    normalizationFailureCount: normalizationFailures.length,
    failures,
    adapterWarnings,
    notes:
      "Strict mode fails for oracle-eligible recipes without computed runtime variants and for records that cannot be normalized without inventing resources. Adapter warnings are preserved for coverage tracking.",
  };
  await fs.mkdir(path.join(outDir, "oracle"), { recursive: true });
  await fs.writeFile(
    path.join(outDir, "oracle", "oracle-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  if (oracleStrict && failures.length > 0) {
    throw new Error(
      `Oracle strict mode failed: ${failures.length} runtime or normalization failure(s). See oracle/oracle-report.json.`,
    );
  }
}

async function stageRenderedIcons(sourceDir, datasetOutDir) {
  const icons = new Map();
  if (!sourceDir || !existsSync(sourceDir)) {
    return icons;
  }
  const targetDir = path.join(datasetOutDir, "textures", "rendered");
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(targetDir, { recursive: true });
  for (const file of await fs.readdir(sourceDir)) {
    if (!file.toLowerCase().endsWith(".png")) {
      continue;
    }
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    await fs.copyFile(sourcePath, targetPath);
    const color = await dominantColorForPng(targetPath);
    icons.set(file, {
      iconPath: `/datasets/gtnh/${datasetVersionId}/textures/rendered/${file}`,
      dominantColor: color,
    });
  }
  return icons;
}

async function dominantColorForPng(filePath) {
  try {
    return getDominantOpaqueColor(PNG.sync.read(await fs.readFile(filePath)));
  } catch {
    return undefined;
  }
}

function renderedIconPath(fileName) {
  return renderedIcons.get(path.basename(String(fileName ?? "")))?.iconPath;
}

function renderedIconColor(fileName) {
  return renderedIcons.get(path.basename(String(fileName ?? "")))?.dominantColor;
}

function normalizeOreDictionary(entries) {
  const normalized = {};
  for (const [name, alternatives] of Object.entries(entries ?? {})) {
    const normalizedAlternatives = (alternatives ?? [])
      .map((entry) => resourceAmount(entry))
      .filter(Boolean);
    oreDictionaryAlternativesByName.set(name, normalizedAlternatives);
    normalized[name] = normalizedAlternatives.map((entry) => entry.id).sort();
  }
  return normalized;
}

function findDomain(id) {
  return (raw.domains ?? []).find((domain) => domain.id === id);
}

function recipeId(...parts) {
  return `oracle:${datasetVersionId}:${parts
    .map((part) => slug(part))
    .filter(Boolean)
    .join(":")}`;
}

function recipeSignature(recipe) {
  return JSON.stringify({
    machineType: recipe.machineType,
    inputs: recipe.inputs.map((entry) => [entry.kind, entry.id, entry.amount, entry.consumed]),
    outputs: recipe.outputs.map((entry) => [entry.kind, entry.id, entry.amount, entry.chance]),
  });
}

function hashRecipe(value) {
  return crypto.createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

function detectProgrammedCircuit(inputs) {
  const circuit = inputs.find(
    (input) => input.kind === "item" && /circuit/i.test(`${input.id} ${input.displayName ?? ""}`),
  );
  if (!circuit) {
    return undefined;
  }
  const meta = /@(\d+)$/.exec(circuit.id)?.[1];
  return meta ? `${resourceLabel(circuit)} (configuration ${meta})` : resourceLabel(circuit);
}

function thaumcraftMachineType(type) {
  if (type === "infusion") return "Thaumcraft Infusion";
  if (type === "crucible") return "Thaumcraft Crucible";
  if (type === "arcane") return "Thaumcraft Arcane Crafting";
  if (type === "essentiaSmelting") return "Thaumcraft Essentia Smelting";
  return "Thaumcraft";
}

function thaumcraftRecipeMapIcon(type) {
  if (type === "infusion") {
    return {
      kind: "item",
      id: "Thaumcraft:blockStoneDevice@2",
      displayName: "Infusion Matrix",
      modId: "Thaumcraft",
    };
  }
  if (type === "crucible") {
    return {
      kind: "item",
      id: "Thaumcraft:blockMetalDevice@0",
      displayName: "Crucible",
      modId: "Thaumcraft",
    };
  }
  if (type === "arcane") {
    return {
      kind: "item",
      id: "Thaumcraft:blockTable@0",
      displayName: "Arcane Worktable",
      modId: "Thaumcraft",
    };
  }
  if (type === "essentiaSmelting") {
    return {
      kind: "item",
      id: "Thaumcraft:blockStoneDevice@0",
      displayName: "Alchemical Furnace",
      modId: "Thaumcraft",
    };
  }
  return undefined;
}

function thaumcraftDuration(type) {
  if (type === "infusion") return 200;
  if (type === "crucible") return 20;
  if (type === "essentiaSmelting") return 10;
  return 1;
}

function voltageTierForEu(eut) {
  const value = Math.abs(Number(eut) || 0);
  const tiers = [
    ["ULV", 8],
    ["LV", 32],
    ["MV", 128],
    ["HV", 512],
    ["EV", 2048],
    ["IV", 8192],
    ["LuV", 32768],
    ["ZPM", 131072],
    ["UV", 524288],
    ["UHV", 2097152],
    ["UEV", 8388608],
    ["UIV", 33554432],
    ["UXV", 134217728],
    ["OpV", 536870912],
  ];
  return tiers.find(([, max]) => value <= max)?.[0] ?? "MAX";
}

function resourceLabel(resource) {
  return resource?.displayName ?? resource?.id ?? "unknown";
}

function compareById(left, right) {
  return `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`);
}

function normalizeChance(value) {
  const chance = Number(value);
  if (!Number.isFinite(chance) || chance < 0) {
    return undefined;
  }
  return Math.max(0, Math.min(1, chance));
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map((entry) => text(entry, "")).filter(Boolean) : undefined;
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function text(value, defaultText) {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : defaultText;
}

function canonicalResourceId(kind, id) {
  if (kind !== "item") {
    return id;
  }
  const separator = id.lastIndexOf("@");
  const baseId = separator >= 0 ? id.slice(0, separator) : id;
  const suffix = separator >= 0 ? id.slice(separator) : "";
  const namespaceSeparator = baseId.indexOf(":");
  if (namespaceSeparator < 0) {
    return `${baseId.toLowerCase()}${suffix}`;
  }
  return `${baseId.slice(0, namespaceSeparator).toLowerCase()}:${baseId
    .slice(namespaceSeparator + 1)
    .toLowerCase()}${suffix}`;
}

function normalizeLabel(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(recipes?|recipe map|map)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function envFlag(name, defaultValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") {
    return defaultValue;
  }
  return /^(1|true|yes|on)$/i.test(rawValue);
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
