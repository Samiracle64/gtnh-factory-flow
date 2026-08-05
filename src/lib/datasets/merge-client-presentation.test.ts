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

describe("merge-client-presentation", () => {
  it("keeps server recipes authoritative and merges only client visuals", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "gtnh-presentation-"));
    temporaryDirectories.push(root);
    const serverDir = path.join(root, "server");
    const clientDir = path.join(root, "client");
    const serverDatasetPath = path.join(serverDir, "recipes.json");
    const clientDatasetPath = path.join(clientDir, "recipes.json");
    await fs.mkdir(path.join(serverDir, "oracle"), { recursive: true });
    await fs.mkdir(path.join(clientDir, "oracle"), { recursive: true });
    await fs.mkdir(path.join(clientDir, "textures", "rendered"), { recursive: true });

    const seed = { kind: "item", id: "IC2:cropSeed#nbt-redwheat", displayName: "RedWheat" };
    await writeDataset(serverDatasetPath, {
      schemaVersion: 1,
      datasetVersionId: "stable-test",
      gtnhVersion: "test",
      resources: [seed],
      recipes: [
        {
          id: "crop:redwheat",
          kind: "crop_produce",
          inputs: [seed],
          outputs: [{ kind: "item", id: "IC2:itemDustsmall@2", amount: 1 }],
          runtimeCalculation: { status: "computed", variants: [{ id: "server-crop" }] },
        },
        {
          id: "thaumcraft:client-process-specific-id",
          kind: "thaumcraft_infusion",
          inputs: [seed],
          outputs: [{ kind: "item", id: "Thaumcraft:ItemEldritchObject@3", amount: 1 }],
          runtimeCalculation: { status: "computed", variants: [{ id: "server-runtime" }] },
          nei: { additionalInfo: ["authoritative"], slots: [] },
        },
      ],
      oreDictionary: {
        sharedOre: ["server:item", "shared:item"],
        serverOre: ["server:item"],
      },
      recipeMaps: ["Crop Harvester", "Infusion"],
      recipeMapIcons: [{ recipeMap: "Crop Harvester", resource: seed }],
    });
    await writeDataset(clientDatasetPath, {
      schemaVersion: 1,
      datasetVersionId: "stable-test",
      gtnhVersion: "test",
      resources: [
        {
          ...seed,
          iconPath: "/datasets/gtnh/stable-test/textures/rendered/redwheat.png",
          dominantColor: "#cc3322",
        },
        {
          kind: "item",
          id: "Thaumcraft:ClientOnly",
          displayName: "Client-only research item",
          iconPath: "/datasets/gtnh/stable-test/textures/rendered/client-only.png",
        },
      ],
      recipes: [
        {
          id: "thaumcraft:shared",
          kind: "thaumcraft_infusion",
          inputs: [seed],
          outputs: [{ kind: "item", id: "Thaumcraft:ItemEldritchObject@3", amount: 1 }],
          runtimeCalculation: { status: "computed", variants: [{ id: "client-runtime" }] },
          nei: {
            source: "gtnh-nei-handler",
            handlerClass: "thaumcraft.nei.InfusionRecipeHandler",
            backgroundImage: "/datasets/gtnh/stable-test/textures/nei-layouts/infusion.png",
            canvas: { width: 170, height: 90 },
            slots: [{ side: "input", kind: "item", slotIndex: 0, x: 12, y: 24 }],
          },
        },
        {
          id: "thaumcraft:client-only",
          kind: "thaumcraft_arcane",
          category: "thaumcraft",
          inputs: [seed],
          outputs: [{ kind: "item", id: "Thaumcraft:ClientOnly", amount: 1 }],
          runtimeCalculation: { status: "computed", variants: [{ id: "client-only-runtime" }] },
        },
        {
          id: "crop:client-runtime-mismatch",
          kind: "crop_produce",
          category: "ic2-crop",
          machineType: "IC2 Crop",
          inputs: [seed],
          outputs: [{ kind: "item", id: "IC2:wrongClientDrop", amount: 1 }],
          runtimeCalculation: { status: "computed", variants: [{ id: "client-crop" }] },
        },
      ],
      oreDictionary: {
        clientOre: ["client:item"],
        sharedOre: ["client:item", "shared:item"],
      },
      recipeMaps: ["Arcane Worktable", "Infusion"],
      recipeMapIcons: [
        {
          recipeMap: "Arcane Worktable",
          resource: { kind: "item", id: "Thaumcraft:ClientOnly" },
        },
      ],
    });
    await fs.writeFile(path.join(serverDir, "oracle", "oracle-report.json"), "server-report");
    await fs.writeFile(path.join(clientDir, "oracle", "oracle-report.json"), "client-report");
    await fs.writeFile(path.join(clientDir, "textures", "rendered", "redwheat.png"), "png");

    const result = spawnSync(
      process.execPath,
      [
        path.join(process.cwd(), "tools/dataset-pipeline/scripts/merge-client-presentation.mjs"),
        serverDatasetPath,
        clientDatasetPath,
        serverDir,
        clientDir,
      ],
      { encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    const merged = JSON.parse(await fs.readFile(serverDatasetPath, "utf8"));
    expect(merged.recipes).toHaveLength(3);
    expect(merged.recipes[0].runtimeCalculation.variants[0].id).toBe("server-crop");
    expect(merged.recipes[1].runtimeCalculation.variants[0].id).toBe("server-runtime");
    expect(merged.recipes[2].runtimeCalculation.variants[0].id).toBe("client-only-runtime");
    expect(merged.recipes[1].nei).toMatchObject({
      additionalInfo: ["authoritative"],
      source: "gtnh-nei-handler",
      backgroundImage: "/datasets/gtnh/stable-test/textures/nei-layouts/infusion.png",
    });
    expect(merged.resources[0]).toMatchObject({
      iconPath: "/datasets/gtnh/stable-test/textures/rendered/redwheat.png",
      dominantColor: "#cc3322",
    });
    expect(merged.recipes[0].inputs[0].iconPath).toContain("redwheat.png");
    expect(merged.recipeMapIcons[0].resource.iconPath).toContain("redwheat.png");
    expect(merged.recipeMaps).toContain("Arcane Worktable");
    expect(merged.recipeMapIcons[1].resource.iconPath).toContain("client-only.png");
    expect(merged.oreDictionary).toEqual({
      sharedOre: ["client:item", "server:item", "shared:item"],
      serverOre: ["server:item"],
      clientOre: ["client:item"],
    });
    expect(await fs.readFile(path.join(serverDir, "oracle", "oracle-report.json"), "utf8")).toBe(
      "server-report",
    );
    expect(
      await fs.readFile(path.join(serverDir, "oracle", "client-oracle-report.json"), "utf8"),
    ).toBe("client-report");
    const mergeReport = JSON.parse(
      await fs.readFile(path.join(serverDir, "oracle", "client-presentation-report.json"), "utf8"),
    );
    expect(mergeReport.skippedClientRecipeCounts).toEqual({ "ic2-crop": 1 });
    await expect(
      fs.stat(path.join(serverDir, "textures", "rendered", "redwheat.png")),
    ).resolves.toBeDefined();
  });
});

async function writeDataset(filePath: string, dataset: Record<string, unknown>) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = ["{"];
  const entries = Object.entries(dataset);
  for (let propertyIndex = 0; propertyIndex < entries.length; propertyIndex += 1) {
    const [key, value] = entries[propertyIndex];
    const prefix = propertyIndex === 0 ? "" : ",";
    if (Array.isArray(value)) {
      lines[lines.length - 1] += prefix;
      lines.push(`  ${JSON.stringify(key)}: [`);
      value.forEach((entry, entryIndex) => {
        lines.push(`    ${JSON.stringify(entry)}${entryIndex < value.length - 1 ? "," : ""}`);
      });
      lines.push("  ]");
    } else if (key === "oreDictionary" && value && typeof value === "object") {
      lines[lines.length - 1] += prefix;
      lines.push(`  ${JSON.stringify(key)}: {`);
      const objectEntries = Object.entries(value);
      objectEntries.forEach(([entryKey, entryValue], entryIndex) => {
        lines.push(
          `    ${JSON.stringify(entryKey)}: ${JSON.stringify(entryValue)}${entryIndex < objectEntries.length - 1 ? "," : ""}`,
        );
      });
      lines.push("  }");
    } else {
      lines[lines.length - 1] += prefix;
      lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)}`);
    }
  }
  lines.push("}");
  await fs.writeFile(filePath, `${lines.join("\n")}\n`);
}
