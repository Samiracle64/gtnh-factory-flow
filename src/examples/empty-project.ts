import { DEFAULT_FUEL_PROFILE_ID, gtnhFuelProfiles } from "@/lib/model/fuels";
import { PROJECT_SCHEMA_VERSION, type FactoryProject } from "@/lib/model/types";

export function createEmptyProject(options: { id?: string; name?: string } = {}): FactoryProject {
  const now = new Date().toISOString();

  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: options.id ?? createProjectId(),
    name: options.name ?? "New factory",
    calculationSettings: {
      probabilityMode: "expected",
      probabilityConfidence: 0.95,
      probabilityWindowSeconds: 60,
    },
    recipes: [],
    nodes: [],
    storages: [],
    edges: [],
    fuelProfiles: gtnhFuelProfiles,
    selectedFuelProfileId: DEFAULT_FUEL_PROFILE_ID,
    notes: "Dataset-backed plan. Recipes must come from a normalized GTNH dataset.",
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  };
}

function createProjectId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `project-${uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}
