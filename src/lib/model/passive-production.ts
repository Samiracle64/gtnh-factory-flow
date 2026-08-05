import type {
  MachineConfigControl,
  MachineConfigTierOption,
  MachineHandler,
  Recipe,
  ResourceAmount,
} from "./types";

export const CROP_STATS_CONTROL_ID = "cropStats";

export const BEE_FRAME_SLOT_CONTROL_PREFIX = "beeFrameSlot";
export const BEE_ENVIRONMENT_CONTROL_ID = "beeEnvironment";
export const BEE_MAGIC_AURA_CONTROL_ID = "beeMagicAura";
export const BEE_ALVEARY_FRAME_HOUSING_CONTROL_ID = "beeAlvearyFrameHousing";
export const BEE_ALVEARY_STIMULATOR_CONTROL_ID = "beeAlvearyStimulator";
export const BEE_ALVEARY_SUPPORT_CONTROL_ID = "beeAlvearySupport";
export const BEE_INDUSTRIAL_SPEED_CONTROL_ID = "beeIndustrialSpeed";
export const BEE_INDUSTRIAL_PRODUCTION_CONTROL_ID = "beeIndustrialProduction";
export const BEE_MEGA_ROYAL_JELLY_CONTROL_ID = "beeMegaRoyalJelly";
export const BEE_APIARY_BASE_PRODUCTION_TERM = 0.1;
const BEE_MAGIC_APIARY_BASE_PRODUCTION_TERM = 0.9;
const BEE_ALVEARY_BASE_PRODUCTION_TERM = 1;
const BEE_INDUSTRIAL_APIARY_BASE_PRODUCTION_TERM = 10;
export const BEE_MEGA_APIARY_BASE_PRODUCTION_TERM = 17.19926784 + 6;
export const MEGA_APIARY_BATCH_CYCLES = 6400 / 550;
const INDUSTRIAL_APIARY_BASE_EUT = 37;
const INDUSTRIAL_APIARY_ACCELERATION_AMP_EUT = [32, 128, 512, 2048, 8192, 32768, 131072, 524288];
const INDUSTRIAL_APIARY_PRODUCTION_EUT_MULTIPLIER = 1.4;

const CROP_CONTROL_IDS = new Set([CROP_STATS_CONTROL_ID]);
const LEGACY_CROP_CONTROL_IDS = new Set([
  "cropHydration",
  "cropNutrients",
  "cropSoil",
  "cropSoilDepth",
  "cropAirQuality",
]);

const BEE_CONTROL_IDS = new Set([
  BEE_ENVIRONMENT_CONTROL_ID,
  BEE_MAGIC_AURA_CONTROL_ID,
  BEE_ALVEARY_FRAME_HOUSING_CONTROL_ID,
  BEE_ALVEARY_STIMULATOR_CONTROL_ID,
  BEE_ALVEARY_SUPPORT_CONTROL_ID,
  BEE_INDUSTRIAL_SPEED_CONTROL_ID,
  BEE_INDUSTRIAL_PRODUCTION_CONTROL_ID,
  BEE_MEGA_ROYAL_JELLY_CONTROL_ID,
]);

export interface CropStatsPreset {
  growth: number;
  gain: number;
  resistance: number;
}

type PassiveProductionRecipeLabel = Pick<Recipe, "machineType" | "source"> & {
  name?: string;
  recipeMap?: string;
};

export function enrichPassiveProductionRecipe(recipe: Recipe): Recipe {
  if (isCropProductionRecipe(recipe)) {
    return enrichCropProductionRecipe(recipe);
  }

  if (isBeeProductionRecipe(recipe)) {
    return enrichBeeProductionRecipe(recipe);
  }

  return recipe;
}

export function isCropProductionRecipe(recipe: PassiveProductionRecipeLabel) {
  const label = passiveProductionLabel(recipe);
  if (label === "tree growth simulator") {
    return false;
  }

  return (
    /\bic2 crops?\b/.test(label) || /\bcropnh\b/.test(label) || /\bcrop production\b/.test(label)
  );
}

export function isBeeProductionRecipe(recipe: PassiveProductionRecipeLabel) {
  const label = passiveProductionLabel(recipe);
  return (
    /\bbee produce\b/.test(label) ||
    /\bbee production\b/.test(label) ||
    /\bbee products?\b/.test(label) ||
    /\bapiary\b/.test(label) ||
    /\balveary\b/.test(label)
  );
}

export function isCropProductionConfigControl(controlId: string) {
  return CROP_CONTROL_IDS.has(controlId);
}

export function isBeeProductionConfigControl(controlId: string) {
  return BEE_CONTROL_IDS.has(controlId) || isBeeFrameSlotControlId(controlId);
}

export function isBeeFrameSlotControlId(controlId: string) {
  return new RegExp(`^${BEE_FRAME_SLOT_CONTROL_PREFIX}\\d+$`).test(controlId);
}

export function getBeeFrameProductionModifier(key: string) {
  switch (key) {
    case "forestry:untreated":
    case "forestry:impregnated":
    case "forestry:proven":
      return 1;
    case "extrabees:cocoa":
      return 0.5;
    case "extrabees:cage":
    case "extrabees:clay":
    case "magicbees:necrotic":
      return -0.25;
    case "extrabees:soul":
      return -0.75;
    case "magicbees:magic":
    case "magicbees:resilient":
      return 2;
    case "magicbees:gentle":
      return 0.4;
    case "magicbees:metabolic":
      return 0.2;
    case "magicbees:oblivion":
      return -9001;
    default:
      return 0;
  }
}

export function getBeeBaseProductionTerm(machineType: string) {
  const label = normalizeLabel(machineType);
  if (label.includes("mega apiary")) {
    return BEE_MEGA_APIARY_BASE_PRODUCTION_TERM;
  }
  if (label.includes("industrial apiary")) {
    return BEE_INDUSTRIAL_APIARY_BASE_PRODUCTION_TERM;
  }
  if (label.includes("magic apiary")) {
    return BEE_MAGIC_APIARY_BASE_PRODUCTION_TERM;
  }
  if (label.includes("alveary")) {
    return BEE_ALVEARY_BASE_PRODUCTION_TERM;
  }
  return BEE_APIARY_BASE_PRODUCTION_TERM;
}

export function isIndustrialApiaryMachineType(machineType: string) {
  return normalizeLabel(machineType).includes("industrial apiary");
}

export function getBeeProductionTermModifier(controlId: string, key: string) {
  if (isBeeFrameSlotControlId(controlId)) {
    return getBeeFrameProductionModifier(key);
  }

  switch (controlId) {
    case BEE_MAGIC_AURA_CONTROL_ID:
      return key === "production-aura" ? 0.9 : 0;
    case BEE_ALVEARY_FRAME_HOUSING_CONTROL_ID:
      return getAlvearyFrameHousingProductionModifier(key);
    case BEE_ALVEARY_STIMULATOR_CONTROL_ID:
      return getAlvearyStimulatorProductionModifier(key);
    case BEE_INDUSTRIAL_SPEED_CONTROL_ID:
      return getIndustrialApiarySpeedProductionModifier(key);
    case BEE_INDUSTRIAL_PRODUCTION_CONTROL_ID:
      return getIndustrialApiaryProductionUpgradeModifier(key);
    default:
      return 0;
  }
}

export function getCropStatsPreset(value: string | undefined): CropStatsPreset | undefined {
  const match = /^(\d+)-(\d+)-(\d+)$/.exec(value ?? "");
  if (!match) {
    return undefined;
  }

  return {
    growth: Number.parseInt(match[1] ?? "0", 10),
    gain: Number.parseInt(match[2] ?? "0", 10),
    resistance: Number.parseInt(match[3] ?? "0", 10),
  };
}

function enrichCropProductionRecipe(recipe: Recipe): Recipe {
  const controls = cropProductionControls(recipe);
  const existingNonCropControls = recipe.machineConfigControls?.filter(
    (control) =>
      !isCropProductionConfigControl(control.id) && !LEGACY_CROP_CONTROL_IDS.has(control.id),
  );
  const machineConfigControls = mergeMachineConfigControls(existingNonCropControls, controls);
  const baseMachine = "Crop Manager";

  return {
    ...recipe,
    inputs: sanitizeCropProductionInputs(recipe.inputs),
    machineType: isPassiveBaseMachine(recipe.machineType) ? baseMachine : recipe.machineType,
    minimumTier: "NONE",
    eut: 0,
    machineHandlers: [],
    machineConfigControls,
    notes: withPassiveProductionNote(
      recipe.notes,
      recipe.runtimeCalculation?.status === "computed"
        ? "Crop production uses only the exact stat presets exported by the GTNH runtime oracle."
        : "Crop production has no selectable estimates because the GTNH runtime oracle did not export a computed variant.",
    ),
  };
}

function enrichBeeProductionRecipe(recipe: Recipe): Recipe {
  const controls = apiaryProductionControls();

  return {
    ...recipe,
    inputs: sanitizeBeeProductionInputs(recipe.inputs),
    machineType: isPassiveBaseMachine(recipe.machineType) ? "Apiary" : recipe.machineType,
    minimumTier: recipe.minimumTier === "UNKNOWN" ? "NONE" : recipe.minimumTier,
    eut: recipe.eut > 0 ? recipe.eut : 0,
    machineHandlers: mergeMachineHandlers(recipe.machineHandlers, beeMachineHandlers()),
    machineConfigControls: mergeMachineConfigControls(recipe.machineConfigControls, controls),
    notes: withPassiveProductionNote(
      recipe.notes,
      recipe.runtimeCalculation?.status === "computed"
        ? "Bee production uses GTNH runtime baseline data when a matching oracle variant exists; unmatched controls fall back to Forestry production modifiers."
        : "Bee production controls are best-effort averages based on Forestry production chance modifiers.",
    ),
  };
}

function cropProductionControls(recipe: Recipe): MachineConfigControl[] {
  if (recipe.runtimeCalculation?.status !== "computed") {
    return [];
  }

  const variants = recipe.runtimeCalculation.variants.filter(
    (variant) => variant.machineConfigTiers?.[CROP_STATS_CONTROL_ID],
  );
  const seen = new Set<string>();
  const tiers = variants.flatMap((variant) => {
    const key = variant.machineConfigTiers?.[CROP_STATS_CONTROL_ID];
    if (!key || seen.has(key)) {
      return [];
    }
    seen.add(key);
    const stats = getCropStatsPreset(key);
    const label =
      variant.label ?? (stats ? `${stats.growth}/${stats.gain}/${stats.resistance}` : key);
    return [
      {
        key,
        label,
        resource: configResource(`crop_stats_${key.replaceAll("-", "_")}`, label, [
          "GTNH oracle crop-stat preset",
          ...(stats
            ? [`Growth: ${stats.growth}`, `Gain: ${stats.gain}`, `Resistance: ${stats.resistance}`]
            : []),
        ]),
      },
    ];
  });
  if (tiers.length === 0) {
    return [];
  }

  return [
    {
      id: CROP_STATS_CONTROL_ID,
      label: "Crop Stats",
      minimumKey: tiers[0]?.key ?? "1-1-1",
      defaultKey: tiers.some((tier) => tier.key === "23-31-0")
        ? "23-31-0"
        : tiers.some((tier) => tier.key === "23-31-1")
          ? "23-31-1"
          : tiers[0]?.key,
      tiers,
    },
  ];
}

function apiaryProductionControls(): MachineConfigControl[] {
  return [
    beeFrameSlotControl(1),
    beeFrameSlotControl(2),
    beeFrameSlotControl(3),
    beeEnvironmentControl(),
  ];
}

function sanitizeCropProductionInputs(inputs: Recipe["inputs"]): Recipe["inputs"] {
  return inputs.map((input) => {
    if (!isIc2CropSeedInput(input)) {
      return input;
    }

    return withoutTooltipLines(input, (line) => /^IC2:itemCropSeed(?:@|$)/i.test(line.trim()));
  });
}

function sanitizeBeeProductionInputs(inputs: Recipe["inputs"]): Recipe["inputs"] {
  return inputs.map((input) => {
    if (!input.id.startsWith("factoryflow:bee_species:")) {
      return input;
    }

    return { ...input, tooltip: undefined };
  });
}

function isIc2CropSeedInput(input: ResourceAmount) {
  return (
    /^IC2:itemCropSeed(?:@|#|$)/i.test(input.id) ||
    input.id.startsWith("factoryflow:ic2_crop_seed:")
  );
}

function withoutTooltipLines(
  input: Recipe["inputs"][number],
  shouldRemove: (line: string) => boolean,
): Recipe["inputs"][number] {
  const tooltip = input.tooltip?.filter((line) => !shouldRemove(line));
  if (!tooltip || tooltip.length === input.tooltip?.length) {
    return input;
  }

  return { ...input, tooltip: tooltip.length > 0 ? tooltip : undefined };
}

function magicApiaryProductionControls(): MachineConfigControl[] {
  return [
    beeFrameSlotControl(1),
    beeFrameSlotControl(2),
    beeFrameSlotControl(3),
    selectControl({
      id: BEE_MAGIC_AURA_CONTROL_ID,
      label: "Aura",
      defaultKey: "none",
      tiers: [
        option("none", "No Aura", "bee_magic_aura_none", "No Production Aura"),
        option(
          "production-aura",
          "Production Aura",
          "MagicBees:visAuraProvider",
          "Production Aura Provider",
        ),
      ],
    }),
    beeEnvironmentControl(),
  ];
}

function alvearyProductionControls(): MachineConfigControl[] {
  return [
    selectControl({
      id: BEE_ALVEARY_FRAME_HOUSING_CONTROL_ID,
      label: "Frame Housings",
      defaultKey: "none",
      tiers: [
        option("none", "None", "bee_alveary_frame_none", "No Frame Housing"),
        option("proven", "1x Proven Frame", "ExtraBees:alveary@1", "Alveary Frame Housing"),
        option("magic", "1x Magic Frame", "ExtraBees:alveary@1", "Alveary Frame Housing"),
        option("four-proven", "4x Proven Frames", "ExtraBees:alveary@1", "Alveary Frame Housings"),
      ],
    }),
    selectControl({
      id: BEE_ALVEARY_STIMULATOR_CONTROL_ID,
      label: "Stimulators",
      defaultKey: "none",
      tiers: [
        option("none", "None", "bee_alveary_stimulator_none", "No Stimulator"),
        option("low-voltage", "1x Low Voltage", "ExtraBees:alveary@4", "Alveary Stimulator"),
        option("high-voltage", "1x High Voltage", "ExtraBees:alveary@4", "Alveary Stimulator"),
        option(
          "four-high-voltage",
          "4x High Voltage",
          "ExtraBees:alveary@4",
          "Alveary Stimulators",
        ),
      ],
    }),
    selectControl({
      id: BEE_ALVEARY_SUPPORT_CONTROL_ID,
      label: "Utility Blocks",
      defaultKey: "plain",
      tiers: [
        option("plain", "Plain", "Forestry:alveary", "Plain Alveary"),
        option("climate", "Climate", "Forestry:alveary@5", "Hygroregulator"),
        option("lighting-rain", "Light/Rain", "ExtraBees:alveary@2", "Rain Shield / Lighting"),
        option("sieve", "Sieve", "Forestry:alveary@7", "Alveary Sieve"),
      ],
    }),
    beeEnvironmentControl(),
  ];
}

function industrialApiaryControls(): MachineConfigControl[] {
  return [
    selectControl({
      id: BEE_INDUSTRIAL_SPEED_CONTROL_ID,
      label: "Acceleration",
      defaultKey: "none",
      tiers: [
        option("none", "0", "bee_industrial_speed_none", "No Acceleration Upgrade"),
        ...Array.from({ length: 8 }, (_unused, index) => {
          const speed = index + 1;
          const multiplier = 2 ** speed;
          return option(
            `speed-${speed}`,
            `x${multiplier}`,
            `gregtech:gt.metaitem.03@${32199 + speed}`,
            `Acceleration Upgrade x${multiplier}`,
            {
              durationMultiplier: 1 / multiplier,
              eutMultiplier: industrialApiaryAccelerationEutMultiplier(speed),
            },
          );
        }),
        option(
          "speed-8-upgraded",
          "Upgraded x256",
          "gregtech:gt.metaitem.03@32208",
          "Upgraded Acceleration Upgrade x256",
          {
            durationMultiplier: 1 / 256,
            eutMultiplier: industrialApiaryAccelerationEutMultiplier(8),
          },
        ),
      ],
    }),
    selectControl({
      id: BEE_INDUSTRIAL_PRODUCTION_CONTROL_ID,
      label: "Production",
      defaultKey: "0",
      tiers: Array.from({ length: 9 }, (_unused, count) =>
        option(
          String(count),
          String(count),
          count === 0 ? "bee_industrial_production_none" : "gregtech:gt.metaitem.03@32209",
          count === 0
            ? "No Production Upgrades"
            : `${count} Production Upgrade${count > 1 ? "s" : ""}`,
          count === 0
            ? {}
            : { eutMultiplier: INDUSTRIAL_APIARY_PRODUCTION_EUT_MULTIPLIER ** count },
        ),
      ),
    }),
    beeEnvironmentControl(),
  ];
}

function megaApiaryControls(): MachineConfigControl[] {
  return [
    selectControl({
      id: BEE_MEGA_ROYAL_JELLY_CONTROL_ID,
      label: "Royal Jelly",
      defaultKey: "none",
      tiers: [
        option("none", "None", "bee_mega_jelly_none", "No Royal Jelly"),
        option("partial", "Partial", "Forestry:royalJelly", "Royal Jelly", {
          outputMultiplier: 2,
        }),
        option("full", "Full", "Forestry:royalJelly", "Royal Jelly", {
          outputMultiplier: 3,
        }),
      ],
    }),
  ];
}

function beeEnvironmentControl(): MachineConfigControl {
  return selectControl({
    id: BEE_ENVIRONMENT_CONTROL_ID,
    label: "Climate",
    defaultKey: "preferred",
    tiers: [
      option("wrong", "Wrong", "bee_environment_wrong", "Wrong Climate"),
      option("tolerated", "Tolerated", "bee_environment_tolerated", "Tolerated Climate"),
      option("preferred", "Preferred", "bee_environment_preferred", "Preferred Climate"),
      option("controlled", "Controlled", "bee_environment_controlled", "Controlled Climate"),
    ],
  });
}

function beeFrameSlotControl(slotIndex: number): MachineConfigControl {
  return selectControl({
    id: `${BEE_FRAME_SLOT_CONTROL_PREFIX}${slotIndex}`,
    label: `Frame ${slotIndex}`,
    defaultKey: "none",
    tiers: [
      option("none", "Empty", "bee_frame_empty", "Empty Frame Slot"),
      option("forestry:untreated", "Untreated", "Forestry:frameUntreated", "Untreated Frame"),
      option(
        "forestry:impregnated",
        "Impregnated",
        "Forestry:frameImpregnated",
        "Impregnated Frame",
      ),
      option("forestry:proven", "Proven", "Forestry:frameProven", "Proven Frame"),
      option("extrabees:cocoa", "Chocolate", "ExtraBees:hiveFrame.cocoa", "Chocolate Frame"),
      option("extrabees:cage", "Restraint", "ExtraBees:hiveFrame.cage", "Restraint Frame"),
      option("extrabees:soul", "Soul", "ExtraBees:hiveFrame.soul", "Soul Frame"),
      option("extrabees:clay", "Healing", "ExtraBees:hiveFrame.clay", "Healing Frame"),
      option("magicbees:magic", "Magic", "MagicBees:frameMagic", "Magic Frame"),
      option("magicbees:resilient", "Resilient", "MagicBees:frameResilient", "Resilient Frame"),
      option("magicbees:gentle", "Gentle", "MagicBees:frameGentle", "Gentle Frame"),
      option("magicbees:metabolic", "Metabolic", "MagicBees:frameMetabolic", "Metabolic Frame"),
      option("magicbees:necrotic", "Necrotic", "MagicBees:frameNecrotic", "Necrotic Frame"),
      option("magicbees:temporal", "Temporal", "MagicBees:frameTemporal", "Temporal Frame"),
      option("magicbees:oblivion", "Oblivion", "MagicBees:frameOblivion", "Oblivion Frame"),
    ],
  });
}

function beeMachineHandlers(): MachineHandler[] {
  return [
    {
      id: "magic-apiary",
      label: "Magic Apiary",
      machineType: "Magic Apiary",
      minimumTier: "NONE",
      eut: 0,
      kind: "single",
      machineConfigControls: magicApiaryProductionControls(),
    },
    {
      id: "alveary",
      label: "Alveary",
      machineType: "Alveary",
      minimumTier: "NONE",
      eut: 0,
      kind: "multiblock",
      machineConfigControls: alvearyProductionControls(),
    },
    {
      id: "industrial-apiary",
      label: "Industrial Apiary",
      machineType: "Industrial Apiary",
      minimumTier: "MV",
      eut: INDUSTRIAL_APIARY_BASE_EUT,
      kind: "automation",
      machineConfigControls: industrialApiaryControls(),
    },
    {
      id: "mega-apiary",
      label: "Mega Apiary",
      machineType: "Mega Apiary",
      minimumTier: "LuV",
      durationTicks: 100,
      eut: 8110,
      kind: "multiblock",
      machineConfigControls: megaApiaryControls(),
    },
  ];
}

function industrialApiaryAccelerationEutMultiplier(speed: number) {
  const addedEut = INDUSTRIAL_APIARY_ACCELERATION_AMP_EUT[speed - 1] ?? 0;
  return (INDUSTRIAL_APIARY_BASE_EUT + addedEut) / INDUSTRIAL_APIARY_BASE_EUT;
}

function getAlvearyFrameHousingProductionModifier(key: string) {
  switch (key) {
    case "proven":
      return getBeeFrameProductionModifier("forestry:proven");
    case "magic":
      return getBeeFrameProductionModifier("magicbees:magic");
    case "four-proven":
      return 4 * getBeeFrameProductionModifier("forestry:proven");
    default:
      return 0;
  }
}

function getAlvearyStimulatorProductionModifier(key: string) {
  switch (key) {
    case "low-voltage":
      return 0.5;
    case "high-voltage":
      return 1.5;
    case "four-high-voltage":
      return 6;
    default:
      return 0;
  }
}

function getIndustrialApiarySpeedProductionModifier(key: string) {
  if (key !== "speed-8-upgraded") {
    return 0;
  }
  return 17.19926784 + 8 - BEE_INDUSTRIAL_APIARY_BASE_PRODUCTION_TERM;
}

function getIndustrialApiaryProductionUpgradeModifier(key: string) {
  const count = Number.parseInt(key, 10);
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  const clampedCount = Math.max(0, Math.min(8, count));
  return 4 * 1.2 ** clampedCount + 8 - BEE_INDUSTRIAL_APIARY_BASE_PRODUCTION_TERM;
}

function selectControl({
  id,
  label,
  defaultKey,
  tiers,
}: {
  id: string;
  label: string;
  defaultKey: string;
  tiers: MachineConfigTierOption[];
}): MachineConfigControl {
  return {
    id,
    label,
    minimumKey: tiers[0]?.key ?? defaultKey,
    defaultKey,
    tiers,
  };
}

function option(
  key: string,
  label: string,
  resourceId: string,
  resourceLabel: string,
  effect: Pick<
    MachineConfigTierOption,
    "durationMultiplier" | "eutMultiplier" | "outputMultiplier" | "parallelMultiplier"
  > = {},
): MachineConfigTierOption {
  return {
    key,
    label,
    ...effect,
    resource: configResource(resourceId, resourceLabel, [label]),
  };
}

function configResource(id: string, displayName: string, tooltip: string[] = []): ResourceAmount {
  return {
    kind: "item",
    id: id.includes(":") ? id : `factoryflow:${id}`,
    amount: 1,
    displayName,
    tooltip,
  };
}

function mergeMachineHandlers(
  existing: Recipe["machineHandlers"],
  incoming: MachineHandler[],
): MachineHandler[] {
  const handlersById = new Map<string, MachineHandler>();
  for (const handler of [...(existing ?? []), ...incoming]) {
    if (isManualHandler(handler)) {
      continue;
    }
    handlersById.set(handler.id, handler);
  }
  return [...handlersById.values()];
}

function mergeMachineConfigControls(
  existing: Recipe["machineConfigControls"],
  incoming: MachineConfigControl[],
): MachineConfigControl[] {
  const controlsById = new Map<string, MachineConfigControl>();
  for (const control of [...incoming, ...(existing ?? [])]) {
    controlsById.set(control.id, control);
  }
  return [...controlsById.values()];
}

function isManualHandler(handler: Pick<MachineHandler, "id" | "label" | "machineType">) {
  const label = normalizeLabel(`${handler.id} ${handler.label} ${handler.machineType}`);
  return /\bmanual\b/.test(label);
}

function isPassiveBaseMachine(machineType: string) {
  const label = normalizeLabel(machineType);
  return (
    label === "ic2 crop" ||
    label === "ic2 crops" ||
    label === "cropnh" ||
    label === "crop production" ||
    label === "bee produce" ||
    label === "bee production" ||
    label === "bee products"
  );
}

function withPassiveProductionNote(notes: string | undefined, note: string) {
  if (!notes) {
    return note;
  }
  return notes.includes(note) ? notes : `${notes}\n${note}`;
}

function passiveProductionLabel(recipe: PassiveProductionRecipeLabel) {
  return normalizeLabel(
    `${recipe.source?.recipeMap ?? recipe.recipeMap ?? ""} ${recipe.machineType}`,
  );
}

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(recipes?|recipe map|map)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
