"use client";

import { Copy, FolderPlus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ProjectSummary } from "@/lib/projects";
import { useFactoryStore } from "@/store/factory-store";

interface ProjectSwitcherProps {
  projects: ProjectSummary[];
  isReady: boolean;
  onCreate: () => void;
  onDuplicate: () => void;
  onSelect: (projectId: string) => void;
  onDelete: () => void;
}

export function ProjectSwitcher({
  projects,
  isReady,
  onCreate,
  onDuplicate,
  onSelect,
  onDelete,
}: ProjectSwitcherProps) {
  const project = useFactoryStore((state) => state.project);
  const renameProject = useFactoryStore((state) => state.renameProject);

  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(110px,1fr)_minmax(110px,1fr)_auto] items-end gap-2 lg:flex lg:flex-1">
      <label className="grid min-w-0 flex-1 gap-0.5 lg:min-w-[150px]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Project
        </span>
        <input
          key={`${project.id}:${project.name}`}
          defaultValue={project.name}
          aria-label="Project name"
          onBlur={(event) => renameProject(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="h-8 min-w-0 rounded border border-neutral-300 bg-white px-2 text-sm font-semibold text-neutral-950"
        />
      </label>
      <label className="grid min-w-0 gap-0.5 lg:min-w-[150px]">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Saved projects
        </span>
        <select
          aria-label="Saved projects"
          value={project.id}
          disabled={!isReady}
          onChange={(event) => onSelect(event.target.value)}
          className="h-8 min-w-0 max-w-56 rounded border border-neutral-300 bg-white px-2 text-xs text-neutral-900 disabled:bg-neutral-100"
        >
          {projects.length === 0 ? <option value={project.id}>{project.name}</option> : null}
          {projects.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name} · {entry.nodeCount} nodes
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-1 pb-px">
        <ProjectButton label="New project" onClick={onCreate}>
          <FolderPlus className="h-4 w-4" />
        </ProjectButton>
        <ProjectButton label="Duplicate project" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </ProjectButton>
        <ProjectButton label="Delete project" onClick={onDelete} disabled={projects.length <= 1}>
          <Trash2 className="h-4 w-4" />
        </ProjectButton>
      </div>
    </div>
  );
}

function ProjectButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-300"
    >
      {children}
    </button>
  );
}
