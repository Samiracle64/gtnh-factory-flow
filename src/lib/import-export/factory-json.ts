import { ZodError } from "zod";
import { normalizeProjectFuelProfiles } from "../model/fuels";
import { factoryProjectSchema } from "../model/schemas";
import { PROJECT_SCHEMA_VERSION, type FactoryProject } from "../model/types";

export class FactoryJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactoryJsonError";
  }
}

export function parseFactoryProjectJson(source: string): FactoryProject {
  let raw: unknown;

  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw new FactoryJsonError(
      `Invalid JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`,
    );
  }

  try {
    return normalizeProjectFuelProfiles(factoryProjectSchema.parse(migrateFactoryProject(raw)));
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ");
      throw new FactoryJsonError(`Invalid factory project: ${issues}`);
    }

    throw error;
  }
}

export function migrateFactoryProject(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const project = raw as Record<string, unknown>;
  if (project.schemaVersion === PROJECT_SCHEMA_VERSION) {
    return project;
  }

  if (project.schemaVersion === 1) {
    const recipes = Array.isArray(project.recipes)
      ? (project.recipes as Array<Record<string, unknown>>)
      : [];
    const datasetVersionId = recipes
      .map((recipe) => recipe.source)
      .filter((source): source is Record<string, unknown> =>
        Boolean(source && typeof source === "object"),
      )
      .map((source) => source.datasetVersionId)
      .find(
        (versionId): versionId is string => typeof versionId === "string" && versionId.length > 0,
      );

    return {
      ...project,
      schemaVersion: PROJECT_SCHEMA_VERSION,
      datasetVersionId,
      calculationSettings: {
        probabilityMode: "expected",
        probabilityConfidence: 0.95,
        probabilityWindowSeconds: 60,
      },
    };
  }

  return project;
}

export function serializeFactoryProject(project: FactoryProject): string {
  const validatedProject = factoryProjectSchema.parse(normalizeProjectFuelProfiles(project));
  return `${JSON.stringify(validatedProject, null, 2)}\n`;
}

export function cloneImportedProject(project: FactoryProject): FactoryProject {
  return {
    ...project,
    id: `project-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    name: `${project.name} (imported)`,
    metadata: {
      ...project.metadata,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}
