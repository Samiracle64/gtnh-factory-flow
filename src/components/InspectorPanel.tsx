"use client";

import { useMemo, useState } from "react";
import { formatRate } from "@/lib/model";
import type { FactoryProject, ResourceAmount, ResourceBalance } from "@/lib/model/types";
import { useFactoryStore } from "@/store/factory-store";
import { ResourceIcon } from "./nei/ResourceIcon";

export function InspectorPanel() {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-white lg:min-h-[360px]">
      <SummaryPanel />
    </aside>
  );
}

function SummaryPanel() {
  const project = useFactoryStore((state) => state.project);
  const result = useFactoryStore((state) => state.lastResult);
  const hoveredNodeBottlenecks = useFactoryStore((state) => state.hoveredNodeBottlenecks);
  const selectedNodeBottlenecks = useFactoryStore((state) => state.selectedNodeBottlenecks);
  const setHoveredNodeBottlenecks = useFactoryStore((state) => state.setHoveredNodeBottlenecks);
  const toggleNodeBottlenecks = useFactoryStore((state) => state.toggleNodeBottlenecks);
  const updateCalculationSettings = useFactoryStore((state) => state.updateCalculationSettings);
  const nodeBottlenecks = result.bottlenecks.filter(
    (bottleneck) => bottleneck.kind === "node-capacity",
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
      <section className="shrink-0 rounded border border-neutral-200 bg-neutral-50 p-2">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Calculation reliability
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="grid gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            Chance outputs
            <select
              aria-label="Chance output calculation"
              value={project.calculationSettings?.probabilityMode ?? "expected"}
              onChange={(event) =>
                updateCalculationSettings({
                  probabilityMode: event.target.value as "expected" | "reliable",
                })
              }
              className="h-8 rounded border border-neutral-300 bg-white px-2 text-xs normal-case tracking-normal text-neutral-900"
            >
              <option value="expected">Long-run average</option>
              <option value="reliable">Reliable lower bound</option>
            </select>
          </label>
          <label className="grid gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            Confidence
            <select
              aria-label="Probability confidence"
              value={project.calculationSettings?.probabilityConfidence ?? 0.95}
              disabled={project.calculationSettings?.probabilityMode !== "reliable"}
              onChange={(event) =>
                updateCalculationSettings({ probabilityConfidence: Number(event.target.value) })
              }
              className="h-8 rounded border border-neutral-300 bg-white px-1 text-xs normal-case tracking-normal text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <option value={0.9}>90%</option>
              <option value={0.95}>95%</option>
              <option value={0.99}>99%</option>
            </select>
          </label>
          <label className="grid gap-1 text-[10px] uppercase tracking-wide text-neutral-500">
            Window
            <select
              aria-label="Probability calculation window"
              value={project.calculationSettings?.probabilityWindowSeconds ?? 60}
              disabled={project.calculationSettings?.probabilityMode !== "reliable"}
              onChange={(event) =>
                updateCalculationSettings({ probabilityWindowSeconds: Number(event.target.value) })
              }
              className="h-8 rounded border border-neutral-300 bg-white px-2 text-xs normal-case tracking-normal text-neutral-900 disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <option value={60}>1 minute</option>
              <option value={300}>5 minutes</option>
              <option value={900}>15 minutes</option>
              <option value={3600}>1 hour</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[10px] leading-4 text-neutral-500">
          Runtime overclocks, parallel and amperage are included. Maintenance and pollution are
          shown only when future oracle exports provide authoritative values.
        </p>
      </section>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <Metric label="Total EU/t" value={formatRate(result.totalEuT, 0)} />
        <Metric label="EU/s" value={formatRate(result.totalEuPerSecond, 0)} />
        <Metric
          label="Node bottlenecks"
          value={String(nodeBottlenecks)}
          active={hoveredNodeBottlenecks || selectedNodeBottlenecks}
          interactive={nodeBottlenecks > 0}
          onMouseEnter={() => setHoveredNodeBottlenecks(nodeBottlenecks > 0)}
          onMouseLeave={() => setHoveredNodeBottlenecks(false)}
          onFocus={() => setHoveredNodeBottlenecks(nodeBottlenecks > 0)}
          onBlur={() => setHoveredNodeBottlenecks(false)}
          onClick={nodeBottlenecks > 0 ? toggleNodeBottlenecks : undefined}
        />
        <Metric label="Nodes" value={String(project.nodes.length)} />
      </div>

      <FlowIOPanel className="min-h-0 rounded border border-neutral-200 bg-white p-3" />
    </div>
  );
}

function FlowIOPanel({ className = "" }: { className?: string }) {
  const project = useFactoryStore((state) => state.project);
  const result = useFactoryStore((state) => state.lastResult);
  const hoveredFlowResourceKey = useFactoryStore((state) => state.hoveredFlowResourceKey);
  const selectedFlowResourceKey = useFactoryStore((state) => state.selectedFlowResourceKey);
  const setHoveredFlowResourceKey = useFactoryStore((state) => state.setHoveredFlowResourceKey);
  const selectFlowResourceKey = useFactoryStore((state) => state.selectFlowResourceKey);
  const [activeTab, setActiveTab] = useState<FlowIOTab>("need");
  const [filter, setFilter] = useState("");
  const resourcesByKey = useMemo(() => buildProjectResourceLookup(project), [project]);
  const allBalances = useMemo(
    () =>
      Object.values(result.resources).sort(
        (left, right) =>
          Math.max(right.deficitPerSecond, right.surplusPerSecond) -
          Math.max(left.deficitPerSecond, left.surplusPerSecond),
      ),
    [result.resources],
  );
  const externalInputs = result.externalInputs;
  const finalOutputs = result.unconsumedOutputs;
  const balanced = allBalances
    .filter(
      (balance) =>
        balance.producedPerSecond > 0 &&
        balance.consumedPerSecond > 0 &&
        balance.deficitPerSecond <= 0.000001 &&
        balance.surplusPerSecond <= 0.000001,
    )
    .sort((left, right) => right.consumedPerSecond - left.consumedPerSecond);
  const tabs: FlowIOTabConfig[] = [
    {
      id: "need",
      label: "Need",
      empty: "No missing inputs.",
      items: externalInputs,
      tone: "red",
      value: (balance) => balance.deficitPerSecond,
    },
    {
      id: "output",
      label: "Output",
      empty: "No unconsumed outputs.",
      items: finalOutputs,
      tone: "emerald",
      value: (balance) => balance.surplusPerSecond,
    },
    {
      id: "internal",
      label: "Internal",
      empty: "No balanced internal resources.",
      items: balanced,
      tone: "neutral",
      value: (balance) => balance.consumedPerSecond,
    },
  ];
  const activeConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const filteredItems = useMemo(
    () => filterFlowItems(activeConfig.items, filter),
    [activeConfig.items, filter],
  );

  return (
    <section className={["flex min-h-0 flex-1 flex-col", className].join(" ")}>
      <label className="block shrink-0">
        <span className="sr-only">Filter Flow I/O resources</span>
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter resources..."
          className="h-8 w-full rounded border border-neutral-300 bg-white px-2 text-xs text-neutral-900 outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-300"
        />
      </label>

      <div className="mt-3 grid shrink-0 grid-cols-3 gap-1 text-center text-[11px]">
        {tabs.map((tab) => (
          <FlowTabButton
            key={tab.id}
            active={activeConfig.id === tab.id}
            label={tab.label}
            value={tab.items.length}
            tone={tab.tone}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}
      </div>

      <FlowIOSection
        title={activeConfig.label}
        empty={filter ? "No matching resources." : activeConfig.empty}
        items={filteredItems}
        totalCount={activeConfig.items.length}
        resourcesByKey={resourcesByKey}
        activeResourceKey={hoveredFlowResourceKey ?? selectedFlowResourceKey}
        selectedResourceKey={selectedFlowResourceKey}
        value={activeConfig.value}
        onHover={setHoveredFlowResourceKey}
        onSelect={selectFlowResourceKey}
      />
    </section>
  );
}

type FlowIOTab = "need" | "output" | "internal";

interface FlowIOTabConfig {
  id: FlowIOTab;
  label: string;
  empty: string;
  items: ResourceBalance[];
  tone: "red" | "emerald" | "neutral";
  value: (balance: ResourceBalance) => number;
}

function FlowTabButton({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "red" | "emerald" | "neutral";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "red"
      ? active
        ? "border-red-400 bg-red-100 text-red-950"
        : "border-red-200 bg-red-50 text-red-900"
      : tone === "emerald"
        ? active
          ? "border-emerald-400 bg-emerald-100 text-emerald-950"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
        : active
          ? "border-neutral-400 bg-neutral-200 text-neutral-950"
          : "border-neutral-200 bg-neutral-50 text-neutral-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={["rounded border px-2 py-1 hover:brightness-95", toneClass].join(" ")}
    >
      <div className="font-semibold">{value}</div>
      <div className="uppercase tracking-wide opacity-70">{label}</div>
    </button>
  );
}

function FlowIOSection({
  title,
  empty,
  items,
  totalCount,
  resourcesByKey,
  activeResourceKey,
  selectedResourceKey,
  value,
  onHover,
  onSelect,
}: {
  title: string;
  empty: string;
  items: ResourceBalance[];
  totalCount: number;
  resourcesByKey: Map<string, FlowResourceDisplay>;
  activeResourceKey?: string;
  selectedResourceKey?: string;
  value: (balance: ResourceBalance) => number;
  onHover: (resourceKey?: string) => void;
  onSelect: (resourceKey: string) => void;
}) {
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        <span>{title}</span>
        <span>
          {items.length === totalCount ? items.length : `${items.length} / ${totalCount}`}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="rounded border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-500">
          {empty}
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {items.map((balance) => {
            const resource = resourcesByKey.get(balance.key);
            const isActive = activeResourceKey === balance.key;
            const isSelected = selectedResourceKey === balance.key;
            return (
              <button
                key={balance.key}
                type="button"
                onMouseEnter={() => onHover(balance.key)}
                onMouseLeave={() => onHover(undefined)}
                onFocus={() => onHover(balance.key)}
                onBlur={() => onHover(undefined)}
                onClick={() => onSelect(balance.key)}
                className={[
                  "grid w-full grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 rounded border px-2 py-1 text-left text-xs",
                  isSelected
                    ? "border-cyan-500 bg-cyan-100 ring-1 ring-cyan-300"
                    : isActive
                      ? "border-cyan-300 bg-cyan-50"
                      : "border-neutral-200 bg-white hover:border-cyan-300 hover:bg-cyan-50",
                ].join(" ")}
                title="Highlight related nodes and cables"
              >
                <ResourceIcon
                  resource={{
                    kind: balance.kind,
                    id: balance.resourceId,
                    amount: 1,
                    displayName: balance.displayName,
                    iconPath: resource?.iconPath,
                    iconAtlas: resource?.iconAtlas,
                  }}
                  size="sm"
                  showAmount={false}
                  bare
                  tooltip={false}
                  className="!h-6 !w-6"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-neutral-900">
                    {balance.displayName ?? balance.resourceId}
                  </span>
                  <span className="block truncate text-[10px] text-neutral-500">
                    +{formatRate(balance.producedPerSecond, 3)}/s -
                    {formatRate(balance.consumedPerSecond, 3)}/s
                  </span>
                </span>
                <span className="font-semibold text-neutral-950">
                  {formatRate(value(balance), 3)}
                  {balance.kind === "fluid" ? "L/s" : "/s"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function filterFlowItems(items: ResourceBalance[], filter: string) {
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) {
    return items;
  }

  return items.filter((balance) =>
    [balance.key, balance.resourceId, balance.displayName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedFilter),
  );
}

type FlowResourceDisplay = Pick<
  ResourceAmount,
  "kind" | "id" | "displayName" | "iconPath" | "iconAtlas" | "dominantColor"
>;

function buildProjectResourceLookup(project: FactoryProject): Map<string, FlowResourceDisplay> {
  const resources = new Map<string, FlowResourceDisplay>();
  const addResource = (resource: FlowResourceDisplay) => {
    const key = `${resource.kind}:${resource.id}`;
    const existing = resources.get(key);
    if (!existing || (!existing.iconPath && resource.iconPath)) {
      resources.set(key, resource);
    }
  };

  for (const recipe of project.recipes) {
    for (const resource of [...recipe.inputs, ...recipe.outputs]) {
      addResource(resource);
    }
  }

  for (const storage of project.storages ?? []) {
    addResource({
      kind: storage.kind,
      id: storage.resourceId,
      displayName: storage.displayName,
      iconPath: storage.iconPath,
      iconAtlas: storage.iconAtlas,
      dominantColor: storage.dominantColor,
    });
  }

  return resources;
}

function Metric({
  label,
  value,
  wide = false,
  active = false,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
}: {
  label: string;
  value: string;
  wide?: boolean;
  active?: boolean;
  interactive?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onClick?: () => void;
}) {
  const className = [
    "rounded border p-2 text-left",
    active
      ? "border-cyan-500 bg-cyan-100 ring-1 ring-cyan-300"
      : "border-neutral-200 bg-neutral-50",
    interactive ? "cursor-pointer hover:border-cyan-300 hover:bg-cyan-50" : "",
    wide ? "col-span-2" : "",
  ].join(" ");
  const content = (
    <>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-neutral-950">{value}</div>
    </>
  );

  if (!interactive) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={className}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      title="Highlight bottleneck nodes"
    >
      {content}
    </button>
  );
}
