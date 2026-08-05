import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe("normalize-oracle-export", () => {
  it("creates stable recipe ids when JVM/raw ids change", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "gtnh-normalizer-"));
    temporaryDirectories.push(root);

    const first = await normalize(root, "first-process-id", "first");
    const second = await normalize(root, "different-process-id", "second");

    expect(first.recipes).toHaveLength(1);
    expect(second.recipes).toHaveLength(1);
    expect(first.recipes[0].id).toBe(second.recipes[0].id);
    expect(first.recipes[0].source.rawRecipeId).toBe("first-process-id");
    expect(second.recipes[0].source.rawRecipeId).toBe("different-process-id");
  });

  it("rejects a strict CropsNH export that did not use the live CropsNH registry", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "gtnh-normalizer-"));
    temporaryDirectories.push(root);
    const directory = path.join(root, "missing-cropsnh-registry");
    const inputPath = path.join(directory, "oracle.json");
    const outputPath = path.join(directory, "recipes.json");
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      inputPath,
      JSON.stringify({
        schemaVersion: 1,
        format: "dev.gtnhplanner.oracle.v1",
        loadedMods: ["IC2", "cropsnh"],
        adapters: [
          {
            id: "ic2-crop-cards",
            status: "computed",
            detected: true,
            recipeCount: 29,
          },
        ],
        domains: [
          { id: "oreDictionary", entries: {} },
          {
            id: "crafting",
            recipes: [
              {
                id: "keep-normalizer-non-empty",
                type: "shaped",
                width: 1,
                height: 1,
                inputs: [{ kind: "item", id: "minecraft:stone", amount: 1 }],
                output: { kind: "item", id: "minecraft:stone_button", amount: 1 },
              },
            ],
          },
          { id: "ic2Crops", crops: [] },
        ],
      }),
    );

    const result = runNormalizer(inputPath, outputPath, true);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Oracle strict mode failed");
    const report = JSON.parse(
      await fs.readFile(path.join(directory, "oracle", "oracle-report.json"), "utf8"),
    );
    expect(report.failures).toContainEqual(
      expect.objectContaining({ adapter: "cropsnh-crops", id: "cropsnh-live-registry" }),
    );
  });

  it("keeps Thaumcraft recipe semantics while applying an exported NEI layout", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "gtnh-normalizer-"));
    temporaryDirectories.push(root);
    const inputPath = path.join(root, "oracle.json");
    const outputPath = path.join(root, "recipes.json");
    await fs.writeFile(
      inputPath,
      JSON.stringify({
        schemaVersion: 1,
        format: "dev.gtnhplanner.oracle.v1",
        adapters: [],
        domains: [
          { id: "oreDictionary", entries: {} },
          {
            id: "thaumcraft",
            recipes: [
              {
                id: "alchemy-layout",
                type: "crucible",
                className: "thaumcraft.api.crafting.CrucibleRecipe",
                output: { kind: "item", id: "thaumcraft:test_output", amount: 1 },
                catalyst: { kind: "item", id: "thaumcraft:test_catalyst", amount: 1 },
                aspects: [{ kind: "aspect", id: "thaumcraft:aspect:aer", amount: 8 }],
                neiLayout: {
                  source: "gtnh-nei-handler",
                  handlerClass: "com.gtnewhorizons.aspectrecipeindex.nei.AlchemyRecipeHandler",
                  backgroundImage: "/datasets/gtnh/stable-test/textures/nei-layouts/alchemy.png",
                  canvas: { width: 170, height: 132 },
                  slots: [
                    {
                      side: "output",
                      slotIndex: 0,
                      x: 75,
                      y: 5,
                      resource: { kind: "item", id: "thaumcraft:test_output", amount: 1 },
                    },
                    {
                      side: "input",
                      slotIndex: 0,
                      x: 54,
                      y: 27,
                      resource: { kind: "item", id: "thaumcraft:test_catalyst", amount: 1 },
                    },
                    {
                      side: "input",
                      slotIndex: 1,
                      x: 64,
                      y: 76,
                      resource: {
                        kind: "item",
                        id: "aspectrecipeindex:aspect@1",
                        amount: 8,
                        nbt: '{Aspect:"aer"}',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }),
    );

    const result = runNormalizer(inputPath, outputPath, false);
    expect(result.status, result.stderr).toBe(0);
    const dataset = JSON.parse(await fs.readFile(outputPath, "utf8"));
    expect(dataset.recipes).toHaveLength(1);
    expect(dataset.recipes[0].inputs).toEqual([
      expect.objectContaining({ id: "thaumcraft:test_catalyst", neiSlot: { x: 54, y: 27 } }),
      expect.objectContaining({
        kind: "aspect",
        id: "thaumcraft:aspect:aer",
        neiSlot: { x: 64, y: 76 },
      }),
    ]);
    expect(dataset.recipes[0].inputs).not.toContainEqual(
      expect.objectContaining({ id: "aspectrecipeindex:aspect@1" }),
    );
    expect(dataset.recipes[0].nei).toMatchObject({
      source: "gtnh-nei-handler",
      handlerClass: "com.gtnewhorizons.aspectrecipeindex.nei.AlchemyRecipeHandler",
      backgroundImage: "/datasets/gtnh/stable-test/textures/nei-layouts/alchemy.png",
    });
  });
});

async function normalize(root: string, rawRecipeId: string, name: string) {
  const directory = path.join(root, name);
  const inputPath = path.join(directory, "oracle.json");
  const outputPath = path.join(directory, "recipes.json");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    inputPath,
    JSON.stringify({
      schemaVersion: 1,
      format: "dev.gtnhplanner.oracle.v1",
      adapters: [],
      domains: [
        { id: "oreDictionary", entries: {} },
        {
          id: "crafting",
          recipes: [
            {
              id: rawRecipeId,
              type: "shaped",
              width: 1,
              height: 1,
              inputs: [
                {
                  kind: "item",
                  id: "minecraft:stone",
                  amount: 1,
                  displayName: "Stone",
                  slotIndex: 0,
                },
              ],
              output: {
                kind: "item",
                id: "minecraft:stone_button",
                amount: 1,
                displayName: "Stone Button",
              },
            },
          ],
        },
      ],
    }),
  );

  const result = runNormalizer(inputPath, outputPath, false);
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(await fs.readFile(outputPath, "utf8"));
}

function runNormalizer(inputPath: string, outputPath: string, strict: boolean) {
  return spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), "tools/dataset-pipeline/scripts/normalize-oracle-export.mjs"),
      inputPath,
      outputPath,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        GTNH_DATASET_VERSION_ID: "stable-test",
        GTNH_DATASET_VERSION_LABEL: "test",
        GTNH_ORACLE_STRICT: strict ? "true" : "false",
      },
    },
  );
}
