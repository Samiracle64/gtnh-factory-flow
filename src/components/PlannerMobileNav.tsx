"use client";

import { BookOpen, ChartNoAxesCombined, Network } from "lucide-react";
import type { ReactNode } from "react";

export type PlannerPanel = "recipes" | "canvas" | "inspector";

export function PlannerMobileNav({
  activePanel,
  onChange,
}: {
  activePanel: PlannerPanel;
  onChange: (panel: PlannerPanel) => void;
}) {
  return (
    <nav
      aria-label="Planner panels"
      className="grid h-14 shrink-0 grid-cols-3 border-t border-neutral-300 bg-white lg:hidden"
    >
      <PanelButton
        label="Recipes"
        active={activePanel === "recipes"}
        onClick={() => onChange("recipes")}
      >
        <BookOpen className="h-4 w-4" />
      </PanelButton>
      <PanelButton
        label="Factory"
        active={activePanel === "canvas"}
        onClick={() => onChange("canvas")}
      >
        <Network className="h-4 w-4" />
      </PanelButton>
      <PanelButton
        label="Results"
        active={activePanel === "inspector"}
        onClick={() => onChange("inspector")}
      >
        <ChartNoAxesCombined className="h-4 w-4" />
      </PanelButton>
    </nav>
  );
}

function PanelButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={[
        "flex min-w-0 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-semibold",
        active
          ? "border-cyan-600 bg-cyan-50 text-cyan-800"
          : "border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
      ].join(" ")}
    >
      {children}
      {label}
    </button>
  );
}
