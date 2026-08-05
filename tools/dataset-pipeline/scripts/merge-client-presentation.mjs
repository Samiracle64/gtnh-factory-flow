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
const serverResourceKeys = new Set();
const serverRecipesBySignature = new Map();
const serverRecipesBySemanticKey = new Map();
const ambiguousServerSemanticKeys = new Set();
const serverRecipeMaps = new Set();
const serverRecipeMapIcons = new Set();
const clientOnlyResources = [];
const clientOnlyRecipes = [];
const clientOnlyRecipeMaps = [];
const clientOnlyRecipeMapIcons = [];
const clientOreDictionary = new Map();
const skippedClientRecipeCounts = new Map();
const clientOnlyRecipeCategories = new Set(["crafting", "furnace", "thaumcraft"]);
let clientRecipeCount = 0;

await visitDatasetContainers(serverDatasetPath, {
  arrays: {
    resources(resource) {
      const key = resourceKey(resource);
      if (key) serverResourceKeys.add(key);
    },
    recipes(recipe) {
      if (recipe?.id) {
        serverRecipesBySignature.set(recipeSignature(recipe), recipe.id);
        indexUniqueSemanticRecipe(recipe, recipe.id);
      }
    },
    recipeMaps(recipeMap) {
      if (typeof recipeMap === "string") serverRecipeMaps.add(recipeMap);
    },
    recipeMapIcons(entry) {
      if (entry?.recipeMap) serverRecipeMapIcons.add(entry.recipeMap);
    },
  },
});

await visitDatasetContainers(clientDatasetPath, {
  arrays: {
    resources(resource) {
      const key = resourceKey(resource);
      const visual = presentationForResource(resource);
      if (key && visual) resourceVisuals.set(key, visual);
      if (key && !serverResourceKeys.has(key)) {
        clientOnlyResources.push(resource);
        serverResourceKeys.add(key);
      }
    },
    recipes(recipe) {
      clientRecipeCount += 1;
      if (!recipe?.id) return;
      const semanticKey = semanticRecipeKey(recipe);
      const serverRecipeId =
        (semanticKey && !ambiguousServerSemanticKeys.has(semanticKey)
          ? serverRecipesBySemanticKey.get(semanticKey)
          : undefined) ?? serverRecipesBySignature.get(recipeSignature(recipe));
      if (!serverRecipeId) {
        if (clientOnlyRecipeCategories.has(recipe.category)) {
          clientOnlyRecipes.push(recipe);
          serverRecipesBySignature.set(recipeSignature(recipe), recipe.id);
        } else {
          const category = recipe.category ?? recipe.kind ?? "unknown";
          skippedClientRecipeCounts.set(
            category,
            (skippedClientRecipeCounts.get(category) ?? 0) + 1,
          );
        }
      } else if (isClientNeiPresentation(recipe.nei)) {
        recipeNeiLayouts.set(serverRecipeId, recipe.nei);
      }
    },
    recipeMaps(recipeMap) {
      if (typeof recipeMap === "string" && !serverRecipeMaps.has(recipeMap)) {
        clientOnlyRecipeMaps.push(recipeMap);
        serverRecipeMaps.add(recipeMap);
      }
    },
    recipeMapIcons(entry) {
      if (entry?.recipeMap && !serverRecipeMapIcons.has(entry.recipeMap)) {
        clientOnlyRecipeMapIcons.push(entry);
        serverRecipeMapIcons.add(entry.recipeMap);
      }
    },
  },
  objects: {
    oreDictionary(key, value) {
      clientOreDictionary.set(key, value);
    },
  },
});

if (clientRecipeCount === 0) {
  throw new Error("Client presentation dataset contains no recipes.");
}

clientOnlyResources.sort(compareById);
clientOnlyRecipeMaps.sort((left, right) => left.localeCompare(right));
clientOnlyRecipeMapIcons.sort((left, right) =>
  String(left.recipeMap).localeCompare(String(right.recipeMap)),
);

await copyClientArtifacts();

const temporaryPath = `${serverDatasetPath}.presentation-${process.pid}.tmp`;
const backupPath = `${serverDatasetPath}.server-${process.pid}.bak`;
const stats = {
  clientRecipeCount,
  resourceVisualCount: resourceVisuals.size,
  clientNeiLayoutCount: recipeNeiLayouts.size,
  semanticRecipeIdentityCount: serverRecipesBySemanticKey.size,
  ambiguousSemanticRecipeIdentityCount: ambiguousServerSemanticKeys.size,
  clientOnlyResourceCount: clientOnlyResources.length,
  clientOnlyRecipeCount: clientOnlyRecipes.length,
  clientOnlyRecipeMapCount: clientOnlyRecipeMaps.length,
  clientOnlyRecipeMapIconCount: clientOnlyRecipeMapIcons.length,
  skippedClientRecipeCounts: Object.fromEntries(
    [...skippedClientRecipeCounts.entries()].sort(([left], [right]) => left.localeCompare(right)),
  ),
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
      authority:
        "The server oracle remains authoritative for shared recipes and runtime calculations. Recipes exposed only by client registries or NEI are appended without replacing server records.",
      ...stats,
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Preserved ${stats.serverRecipeCount} authoritative server recipe(s), appended ${stats.clientOnlyRecipeCount} client-only recipe(s), and merged ${stats.resourceVisualCount} client resource visual(s) plus ${stats.mergedNeiLayoutCount}/${stats.clientNeiLayoutCount} shared client NEI layout(s).`,
);

async function rewriteAuthoritativeDataset(outputPath, mergeStats) {
  const input = readline.createInterface({
    input: createReadStream(serverDatasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  const output = createWriteStream(outputPath, { encoding: "utf8" });
  let currentArray;
  let currentObject;

  try {
    for await (const line of input) {
      const arrayStart = currentArray || currentObject ? undefined : topLevelArrayStart(line);
      if (arrayStart) {
        currentArray = arrayStart;
        await writeLine(output, `${line}\n`);
        continue;
      }

      if (currentArray && isArrayEnd(line)) {
        const additions = additionsForArray(currentArray);
        for (let index = 0; index < additions.length; index += 1) {
          const value = additions[index];
          mergeStats.decoratedResourceReferenceCount += applyResourcePresentation(value);
          await writeLine(
            output,
            `    ${JSON.stringify(value)}${index < additions.length - 1 ? "," : ""}\n`,
          );
        }
        currentArray = undefined;
        await writeLine(output, `${line}\n`);
        continue;
      }

      const objectStart = currentArray || currentObject ? undefined : topLevelObjectStart(line);
      if (objectStart) {
        currentObject = objectStart;
        await writeLine(output, `${line}\n`);
        continue;
      }

      if (currentObject && isObjectEnd(line)) {
        if (currentObject === "oreDictionary") {
          const remainingEntries = [...clientOreDictionary.entries()];
          for (let index = 0; index < remainingEntries.length; index += 1) {
            const [key, value] = remainingEntries[index];
            await writeLine(
              output,
              `    ${JSON.stringify(key)}: ${JSON.stringify(value)}${index < remainingEntries.length - 1 ? "," : ""}\n`,
            );
          }
          clientOreDictionary.clear();
        }
        currentObject = undefined;
        await writeLine(output, `${line}\n`);
        continue;
      }

      if (
        currentArray === "resources" ||
        currentArray === "recipes" ||
        currentArray === "recipeMaps" ||
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
          `    ${JSON.stringify(item.value)}${item.trailingComma || additionsForArray(currentArray).length > 0 ? "," : ""}\n`,
        );
        continue;
      }

      if (currentObject === "oreDictionary") {
        const item = parseObjectItem(line, currentObject);
        const mergedValue = mergeOreDictionaryValues(item.value, clientOreDictionary.get(item.key));
        clientOreDictionary.delete(item.key);
        await writeLine(
          output,
          `    ${JSON.stringify(item.key)}: ${JSON.stringify(mergedValue)}${item.trailingComma || clientOreDictionary.size > 0 ? "," : ""}\n`,
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

async function visitDatasetContainers(datasetPath, visitors) {
  const lines = readline.createInterface({
    input: createReadStream(datasetPath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  let currentArray;
  let currentObject;

  for await (const line of lines) {
    const arrayStart = currentArray || currentObject ? undefined : topLevelArrayStart(line);
    if (arrayStart) {
      currentArray = arrayStart;
      continue;
    }
    if (currentArray && isArrayEnd(line)) {
      currentArray = undefined;
      continue;
    }

    const objectStart = currentArray || currentObject ? undefined : topLevelObjectStart(line);
    if (objectStart) {
      currentObject = objectStart;
      continue;
    }
    if (currentObject && isObjectEnd(line)) {
      currentObject = undefined;
      continue;
    }

    const arrayVisitor = currentArray ? visitors.arrays?.[currentArray] : undefined;
    if (arrayVisitor) {
      arrayVisitor(parseArrayItem(line, currentArray).value);
    }
    const objectVisitor = currentObject ? visitors.objects?.[currentObject] : undefined;
    if (objectVisitor) {
      const item = parseObjectItem(line, currentObject);
      objectVisitor(item.key, item.value);
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

function topLevelObjectStart(line) {
  const match = /^  ("(?:(?:\\.)|[^"\\])*"):\s*\{$/.exec(line);
  return match ? JSON.parse(match[1]) : undefined;
}

function isObjectEnd(line) {
  return /^  \}(?:,)?$/.test(line);
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

function parseObjectItem(line, objectName) {
  const trimmed = line.trim();
  const trailingComma = trimmed.endsWith(",");
  const jsonProperty = trailingComma ? trimmed.slice(0, -1) : trimmed;
  const match = /^("(?:(?:\\.)|[^"\\])*"):\s*(.*)$/.exec(jsonProperty);
  if (!match) {
    throw new Error(`Cannot parse ${objectName} object property.`);
  }
  try {
    return { key: JSON.parse(match[1]), value: JSON.parse(match[2]), trailingComma };
  } catch (error) {
    throw new Error(`Cannot parse ${objectName} object property: ${error.message}`);
  }
}

function additionsForArray(arrayName) {
  if (arrayName === "resources") return clientOnlyResources;
  if (arrayName === "recipes") return clientOnlyRecipes;
  if (arrayName === "recipeMaps") return clientOnlyRecipeMaps;
  if (arrayName === "recipeMapIcons") return clientOnlyRecipeMapIcons;
  return [];
}

function mergeOreDictionaryValues(serverValue, clientValue) {
  if (!Array.isArray(serverValue) || !Array.isArray(clientValue)) {
    return serverValue;
  }
  return [...new Set([...serverValue, ...clientValue])].sort();
}

function recipeSignature(recipe) {
  return JSON.stringify({
    machineType: recipe?.machineType,
    inputs: (recipe?.inputs ?? []).map((entry) => [
      entry.kind,
      entry.id,
      entry.amount,
      entry.consumed,
    ]),
    outputs: (recipe?.outputs ?? []).map((entry) => [
      entry.kind,
      entry.id,
      entry.amount,
      entry.chance,
    ]),
  });
}

function semanticRecipeKey(recipe) {
  const source = recipe?.source;
  const sourceId = source?.sourceIdentifier ?? source?.rawRecipeId;
  if (typeof sourceId !== "string" || sourceId.length === 0) {
    return undefined;
  }
  return JSON.stringify({
    exporter: source?.exporter,
    recipeMap: source?.recipeMap,
    sourceId,
    machineType: recipe?.machineType,
    category: recipe?.category,
  });
}

function indexUniqueSemanticRecipe(recipe, recipeId) {
  const key = semanticRecipeKey(recipe);
  if (!key || ambiguousServerSemanticKeys.has(key)) {
    return;
  }
  const existing = serverRecipesBySemanticKey.get(key);
  if (existing && existing !== recipeId) {
    serverRecipesBySemanticKey.delete(key);
    ambiguousServerSemanticKeys.add(key);
    return;
  }
  serverRecipesBySemanticKey.set(key, recipeId);
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

function isClientNeiPresentation(nei) {
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

function compareById(left, right) {
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""));
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
