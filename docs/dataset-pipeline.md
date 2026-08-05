# Versioned Dataset Pipeline

The browser MVP must not parse a live GTNH modpack. Large GTNH recipe data should be
generated offline, normalized, compressed, versioned, and then served as static dataset
artifacts.

## Goals

- Track stable and daily GTNH versions.
- Preserve source metadata for the GTNH Calculation Oracle.
- Normalize raw exporter output into the internal `RecipeDataset` model.
- Publish immutable datasets at the public URL `/datasets/gtnh/<version>/`, backed by
  a persistent server volume outside the git repository.
- Compare recipe and resource changes between versions.

## Stages

1. Detect GTNH versions
   - Read stable releases and daily builds from the upstream GTNH repositories.
   - Store channel, version id, source URL, and timestamp.

2. Download or locate GTNH build
   - Fetch or mount a clean GTNH client/server build outside the web app.
   - Record pack version, mod list checksum, and exporter versions.

3. Run exporters
   - Execute the GTNH Calculation Oracle in a controlled offline/headless environment.
   - Store raw output as build artifacts, not as app runtime data.

4. Normalize
   - Convert raw recipe maps, items, fluids, ore dictionary entries, circuits, chances,
     byproducts, and machine metadata into internal JSON.
   - Preserve NEI image paths, slot positions, recipe-map names, and additional machine
     metadata when the exporter provides them.
   - Extract matching real Minecraft PNG textures from the selected GTNH instance/mod
     jars and attach `iconPath` only when an actual asset was found.
   - Validate the normalized output with dataset schemas.

5. Extract real icons
   - Scan `assets/<modid>/textures/items`, `blocks`, and `fluids` inside the selected
     GTNH mods.
   - Copy only matched PNGs into the generated dataset directory under
     `<dataset-root>/<version>/textures/`.
   - Render item-stack icons in a headless GTNH client when the exporter runs with
     `GTNH_RENDER_STACK_ICONS=true`. These PNGs are written under
     `<dataset-root>/<version>/textures/rendered/`, finalized to
     `<dataset-root>/<version>/textures/icons/`, and take priority over static jar
     texture matches.
   - Never generate substitute icons. If a stack cannot be rendered by the real client
     and no exact PNG exists, leave the icon blank.

6. Compress and hash
   - Write `recipes.json` and optional compressed variants.
   - Generate SHA-256 checksums for every published artifact.

7. Publish only real generated datasets
   - Place artifacts under the persistent dataset root, for production currently
     `$HOME/data/gtnh-factory-flow/datasets/gtnh/<version>/`.
   - Update `$HOME/data/gtnh-factory-flow/datasets/gtnh/datasets.manifest.json`.
   - Each deployed release exposes that volume through a symlink at
     `public/datasets/gtnh`, so the browser still reads `/datasets/gtnh/...`.
   - If artifacts are hosted elsewhere, set
     `NEXT_PUBLIC_GTNH_DATASET_MANIFEST_URL` to the public manifest URL.
   - Do not point the browser at a private GitHub raw URL that requires a token.
   - Do not publish placeholder versions when the client export fails.

8. Diff versions
   - Compare recipe ids, recipe maps, inputs, outputs, durations, EU/t, circuits, and
     source metadata.
   - Emit machine-readable diffs for UI inspection later.

## Manifest Shape

Dataset types live in `src/lib/datasets/types.ts`:

- `DatasetManifest`
- `DatasetVersion`
- `RecipeDataset`
- `DatasetSourceInfo`

The manifest points to immutable dataset versions. The UI should select a dataset version
from the manifest and load normalized JSON only. The planner UI should never offer manual
recipe creation as a substitute for missing GTNH data.

## GitHub Actions Contract

`.github/workflows/gtnh-dataset-pipeline.yml` detects the current stable and daily GTNH
targets, then calls the exporter runner.

The default runner is `tools/dataset-pipeline/scripts/run-gtnh-oracle-export.sh`. It:

- Downloads the official selected GTNH client build by default.
- Builds and injects the in-repo `gtnhcalcoracle` Forge mod.
- Exports a versioned oracle JSON format from live GTNH registries and renders real
  `ItemStack` icons from the Minecraft client renderer when the client pass is needed.
- Prepares a Forge 1.7.10 client launch from the GTNH Prism/MultiMC instance metadata,
  Minecraft launcher metadata, and Xvfb when no display is available.
- Launches the pack headlessly as a client unless `GTNH_EXPORT_PACK_KIND=server` is set.
- Uses the real runtime recipe registries from the GTNH build/exporter.
- Normalizes oracle output into the internal `RecipeDataset` shape.
- Stores rendered client stack icons first, publishes them as standalone `textures/icons`
  PNGs, then extracts real matching texture PNGs from the selected GTNH mods for resources
  that still do not have an icon.
- Write `$GTNH_DATASET_OUT_DIR/recipes.json`.

`GTNH_CLIENT_EXPORT_COMMAND` can still override this default with another private runner,
for example a Prism + NESQL Exporter path once account/cache handling is available.

The command receives these directories:

- `GTNH_INSTANCE_DIR` for the client instance/cache.
- `GTNH_RAW_EXPORT_DIR` for raw exporter output.
- `GTNH_DATASET_OUT_DIR` for normalized app artifacts.

It also receives version metadata through `GTNH_DATASET_VERSION_ID`,
`GTNH_DATASET_VERSION_LABEL`, `GTNH_DATASET_CHANNEL`, `GTNH_SOURCE_KIND`,
`GTNH_SOURCE_REF`, and `GTNH_SOURCE_URL`.

If the runner fails or produces no recipes, the workflow fails and publishes nothing. This
prevents fake GTNH versions from appearing in the hosted UI.

## Oracle Integration Notes

The oracle mod writes `dev.gtnhplanner.oracle.v1` JSON under `GTNH-Calc-Oracle` in the
selected instance. It has adapters for GregTech recipe maps, Minecraft/Forge crafting and
smelting, Thaumcraft crafting registries, Forestry bee species products, and IC2 crop-card
metadata. The normalizer fails strict mode for oracle-eligible recipes that lack computed
runtime variants and writes coverage details to `oracle/oracle-report.json`.

After the server/client merge, generation also writes
`oracle/dataset-quality-report.json`. The build fails before publication if stable or daily drops
below its guarded recipe, NEI-layout, NEI-background, crop, or computed-runtime baseline. The gate
also requires all three crop stat variants, distinct NBT seed identities for every crop, and zero
oracle-eligible recipes without a computed runtime result. Thresholds can be raised or temporarily
overridden with `GTNH_QUALITY_MIN_<METRIC>` environment variables, but default to conservative
values below the current healthy datasets.

Shared server/client recipes are matched first through their exported semantic source identity
(`recipeMap` plus `rawRecipeId`/`sourceIdentifier`) and then through the legacy resource signature.
This lets the client attach NEI presentation when harmless numeric differences exist, while the
server recipe, inputs, outputs, and runtime calculations remain authoritative.

## Non-Goals For MVP

- No in-browser modpack parsing.
- No direct dependency on raw exporter output in the planner UI.
- No claim that demo data is authoritative.
- No public dump import as a substitute for running a client/exporter.
