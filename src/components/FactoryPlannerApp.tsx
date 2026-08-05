"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DATASET_MANIFEST_URL,
  fetchDatasetManifest,
  pickDefaultDatasetVersion,
} from "@/lib/datasets";
import { getRecipeDatasetRecipe, initRecipeDatasetVersion } from "@/lib/datasets/browser-loader";
import { createEmptyProject } from "@/examples";
import {
  deleteProject,
  listProjects,
  loadProject,
  loadProjectLibrary,
  saveProject,
  setActiveProjectId,
  type ProjectSummary,
} from "@/lib/projects";
import { loadResourceHistory, useFactoryStore } from "@/store/factory-store";
import { FactoryFlow } from "./flow/FactoryFlow";
import { InspectorPanel } from "./InspectorPanel";
import { RecipeBrowser } from "./RecipeBrowser";
import { TopBar } from "./TopBar";
import { PlannerMobileNav, type PlannerPanel } from "./PlannerMobileNav";

export function FactoryPlannerApp() {
  const project = useFactoryStore((state) => state.project);
  const markHydratedProject = useFactoryStore((state) => state.markHydratedProject);
  const hydrateResourceHistory = useFactoryStore((state) => state.hydrateResourceHistory);
  const setDatasetManifest = useFactoryStore((state) => state.setDatasetManifest);
  const setDataset = useFactoryStore((state) => state.setDataset);
  const refreshProjectRecipes = useFactoryStore((state) => state.refreshProjectRecipes);
  const setDatasetLoading = useFactoryStore((state) => state.setDatasetLoading);
  const setDatasetError = useFactoryStore((state) => state.setDatasetError);
  const hydratedRef = useRef(false);
  const skipInitialSaveRef = useRef(true);
  const saveTimeoutRef = useRef<number | undefined>(undefined);
  const [projectSummaries, setProjectSummaries] = useState<ProjectSummary[]>([]);
  const [isProjectLibraryReady, setProjectLibraryReady] = useState(false);
  const [activePanel, setActivePanel] = useState<PlannerPanel>("canvas");

  const refreshProjectSummaries = useCallback(async () => {
    setProjectSummaries(await listProjects());
  }, []);

  const loadDatasetVersion = useCallback(
    async (versionId: string) => {
      const state = useFactoryStore.getState();
      const manifest = state.datasetManifest;
      const manifestUrl = state.datasetManifestUrl ?? DEFAULT_DATASET_MANIFEST_URL;
      const version = manifest?.versions.find((entry) => entry.id === versionId);

      if (!manifest || !version) {
        setDatasetError(`Dataset version "${versionId}" is not available in the manifest.`);
        return;
      }

      try {
        setDatasetLoading(true);
        const dataset = await initRecipeDatasetVersion(manifestUrl, version);
        setDataset(dataset);
        const projectRecipes = useFactoryStore.getState().project.recipes;
        if (projectRecipes.length > 0) {
          const refreshedRecipes = (
            await Promise.allSettled(
              projectRecipes.map((recipe) =>
                getRecipeDatasetRecipe(manifestUrl, version, recipe.id),
              ),
            )
          )
            .filter((result): result is PromiseFulfilledResult<(typeof projectRecipes)[number]> => {
              return result.status === "fulfilled";
            })
            .map((result) => result.value);
          refreshProjectRecipes(refreshedRecipes);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Dataset load failed.";
        setDatasetError(message);
      }
    },
    [refreshProjectRecipes, setDataset, setDatasetError, setDatasetLoading],
  );

  useEffect(() => {
    const cancelHydration = scheduleIdleWork(() => {
      hydrateResourceHistory(loadResourceHistory());
      void (async () => {
        try {
          const library = await loadProjectLibrary();
          const nextProject =
            library.activeProject ??
            createEmptyProject({ name: library.projects.length ? "New factory" : "GTNH Planner" });
          hydratedRef.current = true;
          skipInitialSaveRef.current = Boolean(library.activeProject);
          markHydratedProject(nextProject);
          if (!library.activeProject) {
            await saveProject(nextProject);
            await setActiveProjectId(nextProject.id);
          }
          await refreshProjectSummaries();
        } catch (error) {
          console.error(
            error instanceof Error ? error.message : "Project library could not be loaded.",
          );
          hydratedRef.current = true;
        } finally {
          setProjectLibraryReady(true);
        }
      })();
    }, 800);

    return cancelHydration;
  }, [hydrateResourceHistory, markHydratedProject, refreshProjectSummaries]);

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      try {
        setDatasetLoading(true);
        const manifest = await fetchDatasetManifest(DEFAULT_DATASET_MANIFEST_URL);
        if (cancelled) {
          return;
        }

        setDatasetManifest(manifest, DEFAULT_DATASET_MANIFEST_URL);
        if (!pickDefaultDatasetVersion(manifest)) {
          setDatasetLoading(false);
          return;
        }

        void loadDatasetVersion(pickDefaultDatasetVersion(manifest)!.id);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Dataset manifest load failed.";
        setDatasetError(message);
      }
    }

    void loadManifest();

    return () => {
      cancelled = true;
    };
  }, [loadDatasetVersion, setDatasetError, setDatasetLoading, setDatasetManifest]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }

    if (saveTimeoutRef.current !== undefined) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      scheduleIdleWork(() => {
        void saveProject(project)
          .then(() => setActiveProjectId(project.id))
          .then(refreshProjectSummaries)
          .catch((error) => {
            console.error(
              error instanceof Error ? error.message : "Plan could not be saved locally.",
            );
          });
      }, 1200);
    }, 350);

    return () => {
      if (saveTimeoutRef.current !== undefined) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [project, refreshProjectSummaries]);

  const activateProject = useCallback(
    async (nextProjectId: string) => {
      if (nextProjectId === project.id) {
        return;
      }
      await saveProject(project);
      const nextProject = await loadProject(nextProjectId);
      if (!nextProject) {
        return;
      }
      markHydratedProject(nextProject);
      await setActiveProjectId(nextProject.id);
      await refreshProjectSummaries();
      if (nextProject.datasetVersionId) {
        await loadDatasetVersion(nextProject.datasetVersionId);
      }
    },
    [loadDatasetVersion, markHydratedProject, project, refreshProjectSummaries],
  );

  const createProject = useCallback(async () => {
    await saveProject(project);
    const nextProject = {
      ...createEmptyProject(),
      datasetVersionId: useFactoryStore.getState().selectedDatasetVersionId,
    };
    markHydratedProject(nextProject);
    await saveProject(nextProject);
    await setActiveProjectId(nextProject.id);
    await refreshProjectSummaries();
  }, [markHydratedProject, project, refreshProjectSummaries]);

  const duplicateProject = useCallback(async () => {
    const scaffold = createEmptyProject({ name: `${project.name} copy` });
    const duplicate = {
      ...project,
      id: scaffold.id,
      name: scaffold.name,
      metadata: scaffold.metadata,
    };
    markHydratedProject(duplicate);
    await saveProject(duplicate);
    await setActiveProjectId(duplicate.id);
    await refreshProjectSummaries();
  }, [markHydratedProject, project, refreshProjectSummaries]);

  const removeActiveProject = useCallback(async () => {
    if (projectSummaries.length <= 1) {
      return;
    }
    if (!window.confirm(`Delete project "${project.name}"?`)) {
      return;
    }
    const nextProjectId = projectSummaries.find((entry) => entry.id !== project.id)?.id;
    await deleteProject(project.id);
    if (nextProjectId) {
      const nextProject = await loadProject(nextProjectId);
      if (nextProject) {
        markHydratedProject(nextProject);
        await setActiveProjectId(nextProject.id);
      }
    }
    await refreshProjectSummaries();
  }, [markHydratedProject, project.id, project.name, projectSummaries, refreshProjectSummaries]);

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-neutral-100 text-neutral-950">
      <TopBar
        onLoadDatasetVersion={loadDatasetVersion}
        projects={projectSummaries}
        isProjectLibraryReady={isProjectLibraryReady}
        onCreateProject={() => void createProject()}
        onDuplicateProject={() => void duplicateProject()}
        onSelectProject={(projectId) => void activateProject(projectId)}
        onDeleteProject={() => void removeActiveProject()}
      />
      <main className="relative grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[360px_minmax(0,1fr)_360px]">
        <div className={`${activePanel === "recipes" ? "flex" : "hidden"} min-h-0 min-w-0 lg:flex`}>
          <RecipeBrowser />
        </div>
        <div className={`${activePanel === "canvas" ? "flex" : "hidden"} min-h-0 min-w-0 lg:flex`}>
          <FactoryFlow />
        </div>
        <div
          className={`${activePanel === "inspector" ? "flex" : "hidden"} min-h-0 min-w-0 lg:flex`}
        >
          <InspectorPanel />
        </div>
      </main>
      <PlannerMobileNav activePanel={activePanel} onChange={setActivePanel} />
    </div>
  );
}

function scheduleIdleWork(callback: () => void, timeout: number) {
  const browserWindow = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

  if (browserWindow.requestIdleCallback && browserWindow.cancelIdleCallback) {
    const idleId = browserWindow.requestIdleCallback(callback, { timeout });
    return () => browserWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = globalThis.setTimeout(callback, 0);
  return () => globalThis.clearTimeout(timeoutId);
}
