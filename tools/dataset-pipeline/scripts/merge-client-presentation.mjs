import fs from "node:fs/promises";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { once } from "node:events";

const serverDatasetPath = process.argv[2];
const clientDatasetPath = process.argv[3];
const serverDatasetDir = process.argv[4];
const clientDatasetDir = process.argv[5];

if (!serverDatasetPath || !clientDatasetPath || !serverDatasetDir || !clientDatasetDir) {
  throw new Error(
    "Usage: merge-client-presentation.mjs <server-recipes.json> <client-recipes.json> <server-dataset-dir> <client-dataset-dir>",
  );
}

if (!existsSync(serverDatasetPath)) {
  throw new Error(`Authoritative server dataset not found: ${serverDatasetPath}`);
}
if (!existsSync(clientDatasetPath)) {
  throw new Error(`Client presentation dataset not found: ${clientDatasetPath}`);
}

const resourceVisuals = new Map();
const recipeNeiLayouts = new Map();
let clientRecipeCount = 0;

await visitDatasetArrays(clientDatasetPath, {
  resources(resource) {
    const visual = presentationForResource(resource);
    if (visual) {
      resourceVisuals.set(resourceKey(resource), visual);
    }
  },
  recipes(recipe) {
    clientRecipeCount += 1;
    if (recipe?.id && isClientOnlyNeiLayout(recipe.nei)) {
      recipeNeiLayouts.set(recipe.id, recipe.nei);
    }
  },
});

if (clientRecipeCount === 0) {
  throw new Error("Client presentation dataset contains no recipes.");
}

await copyClientArtifacts();

const temporaryPath = `${serverDatasetPath}.presentation-${process.pid}.tmp`;
const backupPath = `${serverDatasetPath}.server-${process.pid}.bak`;
const stats = {
  clientRecipeCount,
  resourceVisualCount: resourceVisuals.size,
  clientNeiLayoutCount: recipeNeiLayouts.size,
  serverRecipeCount: 0,
  decoratedResourceReferenceCount: 0,
  mergedNeiLayoutCount: 0,
};

try {
  await rewriteAuthoritativeDataset(temporaryPath, stats);
  await fs.rename(serverDatasetPath, backupPath);
  try {
    await fs.rename(temporaryPath, serverDatasetPath);
  } catch (error) {
    await fs.rename(backupPath, serverDatasetPath);
    throw error;
  }
  await fs.rm(backupPath, { force: true });
} finally {
  await fs.rm(temporaryPath, { force: true });
}

const reportDir = path.join(serverDatasetDir, "oracle");
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(
  path.join(reportDir, "client-presentation-report.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      source: "client-presentation-pass",
      authority: "The server oracle remains authoritative for recipes and runtime calculations.",
      ...stats,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Merged ${stats.resourceVisualCount} client resource visual(s) and ${stats.mergedNeiLayoutCount}/${stats.clientNeiLayoutCount} client-only NEI layout(s) into ${stats.serverRecipeCount} authoritative server recipe(s).`,
);

async function rewriteAuthoritativeDataset(outputPath, mergeStats) {
  const input = readline.createInterface({
    input: createReadStream(serverDatasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const output = createWriteStream(outputPath, { encoding: "utf8" });
  let currentArray;

  try {
    for await (const line of input) {
      const arrayStart = currentArray ? undefined : topLevelArrayStart(line);
      if (arrayStart) {
        currentArray = arrayStart;
        await writeLine(output, `${line}\n`);
        continue;
      }

      if (currentArray && isArrayEnd(line)) {
        currentArray = undefined;
        await writeLine(output, `${line}\n`);
        continue;
      }

      if (
        currentArray === "resources" ||
        currentArray === "recipes" ||
        currentArray === "recipeMapIcons"
      ) {
        const item = parseArrayItem(line, currentArray);
        if (currentArray === "recipes") {
          mergeStats.serverRecipeCount += 1;
          const clientNei = recipeNeiLayouts.get(item.value?.id);
          if (clientNei) {
            item.value.nei = { ...(item.value.nei ?? {}), ...clientNei };
            mergeStats.mergedNeiLayoutCount += 1;
          }
        }
        mergeStats.decoratedResourceReferenceCount += applyResourcePresentation(item.value);
        await writeLine(
          output,
          `    ${JSON.stringify(item.value)}${item.trailingComma ? "," : ""}\n`,
        );
        continue;
      }

      await writeLine(output, `${line}\n`);
    }

    output.end();
    await once(output, "finish");
  } catch (error) {
    output.destroy();
    throw error;
  }
}

async function visitDatasetArrays(datasetPath, visitors) {
  const lines = readline.createInterface({
    input: createReadStream(datasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let currentArray;

  for await (const line of lines) {
    const arrayStart = currentArray ? undefined : topLevelArrayStart(line);
    if (arrayStart) {
      currentArray = arrayStart;
      continue;
    }
    if (currentArray && isArrayEnd(line)) {
      currentArray = undefined;
      continue;
    }
    const visitor = currentArray ? visitors[currentArray] : undefined;
    if (visitor) {
      visitor(parseArrayItem(line, currentArray).value);
    }
  }
}

function topLevelArrayStart(line) {
  const match = /^  ("(?:(?:\\.)|[^"\\])*"):\s*\[$/.exec(line);
  return match ? JSON.parse(match[1]) : undefined;
}

function isArrayEnd(line) {
  return /^  \](?:,)?$/.test(line);
}

function parseArrayItem(line, arrayName) {
  const trimmed = line.trim();
  const trailingComma = trimmed.endsWith(",");
  const json = trailingComma ? trimmed.slice(0, -1) : trimmed;
  try {
    return { value: JSON.parse(json), trailingComma };
  } catch (error) {
    throw new Error(`Cannot parse ${arrayName} array item: ${error.message}`);
  }
}

function presentationForResource(resource) {
  if (!resourceKey(resource)) {
    return undefined;
  }
  const presentation = removeUndefined({
    iconPath: resource.iconPath,
    iconAtlas: resource.iconAtlas,
    dominantColor: resource.dominantColor,
  });
  return Object.keys(presentation).length > 0 ? presentation : undefined;
}

function isClientOnlyNeiLayout(nei) {
  return Boolean(
    nei &&
    typeof nei === "object" &&
    (typeof nei.backgroundImage === "string" || nei.source === "gtnh-nei-handler"),
  );
}

function applyResourcePresentation(value) {
  if (!value || typeof value !== "object") {
    return 0;
  }

  let decorated = 0;
  if (!Array.isArray(value)) {
    const presentation = resourceVisuals.get(resourceKey(value));
    if (presentation) {
      Object.assign(value, presentation);
      decorated += 1;
    }
  }

  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    decorated += applyResourcePresentation(child);
  }
  return decorated;
}

function resourceKey(resource) {
  return typeof resource?.kind === "string" && typeof resource?.id === "string"
    ? `${resource.kind}:${resource.id}`
    : undefined;
}

async function copyClientArtifacts() {
  const clientTextures = path.join(clientDatasetDir, "textures");
  if (existsSync(clientTextures)) {
    await fs.mkdir(path.join(serverDatasetDir, "textures"), { recursive: true });
    await fs.cp(clientTextures, path.join(serverDatasetDir, "textures"), {
      recursive: true,
      force: true,
    });
  }

  const clientOracleReport = path.join(clientDatasetDir, "oracle", "oracle-report.json");
  if (existsSync(clientOracleReport)) {
    const serverOracleDir = path.join(serverDatasetDir, "oracle");
    await fs.mkdir(serverOracleDir, { recursive: true });
    await fs.copyFile(clientOracleReport, path.join(serverOracleDir, "client-oracle-report.json"));
  }
}

async function writeLine(stream, line) {
  if (!stream.write(line)) {
    await once(stream, "drain");
  }
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
