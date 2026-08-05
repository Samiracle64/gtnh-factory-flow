import { parseFactoryProjectJson, serializeFactoryProject } from "@/lib/import-export";
import type { FactoryProject } from "@/lib/model/types";

const DATABASE_NAME = "gtnh-factory-flow";
const DATABASE_VERSION = 1;
const PROJECT_STORE = "projects";
const META_STORE = "meta";
const ACTIVE_PROJECT_KEY = "active-project";
const LEGACY_PROJECT_KEY = "gtnh-factory-flow.project.v2";
const FALLBACK_LIBRARY_KEY = "gtnh-factory-flow.project-library.v1";

export interface ProjectSummary {
  id: string;
  name: string;
  datasetVersionId?: string;
  nodeCount: number;
  updatedAt?: string;
}

export interface ProjectLibrarySnapshot {
  projects: ProjectSummary[];
  activeProject?: FactoryProject;
}

interface MetaRecord {
  key: string;
  value: string;
}

export async function loadProjectLibrary(): Promise<ProjectLibrarySnapshot> {
  const projects = await readAllProjects();
  if (projects.length === 0) {
    const legacyProject = readLegacyProject();
    if (legacyProject) {
      await saveProject(legacyProject);
      await setActiveProjectId(legacyProject.id);
      return { projects: [summarizeProject(legacyProject)], activeProject: legacyProject };
    }
    return { projects: [] };
  }

  const activeProjectId = await readActiveProjectId();
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ??
    [...projects].sort(compareProjects)[0];
  if (activeProject && activeProject.id !== activeProjectId) {
    await setActiveProjectId(activeProject.id);
  }
  return {
    projects: projects.map(summarizeProject).sort(compareProjectSummaries),
    activeProject,
  };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return (await readAllProjects()).map(summarizeProject).sort(compareProjectSummaries);
}

export async function loadProject(projectId: string): Promise<FactoryProject | undefined> {
  if (!hasIndexedDb()) {
    return readFallbackProjects().find((project) => project.id === projectId);
  }
  const database = await openDatabase();
  const value = await requestAsPromise(
    database.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).get(projectId),
  );
  database.close();
  return parseStoredProject(value);
}

export async function saveProject(project: FactoryProject): Promise<void> {
  const validated = parseFactoryProjectJson(serializeFactoryProject(project));
  if (!hasIndexedDb()) {
    const projects = readFallbackProjects();
    const nextProjects = [validated, ...projects.filter((entry) => entry.id !== validated.id)];
    writeFallbackProjects(nextProjects);
    return;
  }

  const database = await openDatabase();
  await transactionComplete(database, PROJECT_STORE, "readwrite", (store) => store.put(validated));
  database.close();
}

export async function deleteProject(projectId: string): Promise<void> {
  if (!hasIndexedDb()) {
    writeFallbackProjects(readFallbackProjects().filter((project) => project.id !== projectId));
    return;
  }
  const database = await openDatabase();
  await transactionComplete(database, PROJECT_STORE, "readwrite", (store) =>
    store.delete(projectId),
  );
  database.close();
}

export async function setActiveProjectId(projectId: string): Promise<void> {
  if (!hasIndexedDb()) {
    globalThis.localStorage?.setItem(ACTIVE_PROJECT_KEY, projectId);
    return;
  }
  const database = await openDatabase();
  await transactionComplete(database, META_STORE, "readwrite", (store) =>
    store.put({ key: ACTIVE_PROJECT_KEY, value: projectId } satisfies MetaRecord),
  );
  database.close();
}

export function summarizeProject(project: FactoryProject): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    datasetVersionId: project.datasetVersionId,
    nodeCount: project.nodes.length,
    updatedAt: project.metadata?.updatedAt,
  };
}

async function readAllProjects(): Promise<FactoryProject[]> {
  if (!hasIndexedDb()) {
    return readFallbackProjects();
  }
  const database = await openDatabase();
  const values = await requestAsPromise<unknown[]>(
    database.transaction(PROJECT_STORE, "readonly").objectStore(PROJECT_STORE).getAll(),
  );
  database.close();
  return values
    .map(parseStoredProject)
    .filter((project): project is FactoryProject => Boolean(project));
}

async function readActiveProjectId(): Promise<string | undefined> {
  if (!hasIndexedDb()) {
    return globalThis.localStorage?.getItem(ACTIVE_PROJECT_KEY) ?? undefined;
  }
  const database = await openDatabase();
  const value = await requestAsPromise<MetaRecord | undefined>(
    database.transaction(META_STORE, "readonly").objectStore(META_STORE).get(ACTIVE_PROJECT_KEY),
  );
  database.close();
  return value?.value;
}

function readLegacyProject(): FactoryProject | undefined {
  const source = globalThis.localStorage?.getItem(LEGACY_PROJECT_KEY);
  if (!source) {
    return undefined;
  }
  try {
    return parseFactoryProjectJson(source);
  } catch {
    return undefined;
  }
}

function readFallbackProjects(): FactoryProject[] {
  const source = globalThis.localStorage?.getItem(FALLBACK_LIBRARY_KEY);
  if (!source) {
    return [];
  }
  try {
    const values = JSON.parse(source) as unknown[];
    return values
      .map(parseStoredProject)
      .filter((project): project is FactoryProject => Boolean(project));
  } catch {
    return [];
  }
}

function writeFallbackProjects(projects: FactoryProject[]): void {
  globalThis.localStorage?.setItem(FALLBACK_LIBRARY_KEY, JSON.stringify(projects));
}

function parseStoredProject(value: unknown): FactoryProject | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return parseFactoryProjectJson(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function compareProjects(left: FactoryProject, right: FactoryProject): number {
  return (right.metadata?.updatedAt ?? "").localeCompare(left.metadata?.updatedAt ?? "");
}

function compareProjectSummaries(left: ProjectSummary, right: ProjectSummary): number {
  return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
}

function hasIndexedDb(): boolean {
  return typeof globalThis.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open project storage."));
  });
}

function requestAsPromise<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Project storage request failed."));
  });
}

function transactionComplete(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    operation(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Project storage transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Project storage transaction was aborted."));
  });
}
