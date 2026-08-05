import { GT_VOLTAGE_TIERS } from "@/lib/model/tiers";
import type { MachineTier } from "@/lib/model/types";

type VoltageTier = Exclude<MachineTier, "DEMO">;

export function calculateMachineAmperage(
  eutPerOperation: number,
  tier: VoltageTier,
  machineCount: number,
  effectiveParallel: number,
): number {
  if (eutPerOperation <= 0 || machineCount <= 0 || effectiveParallel <= 0) {
    return 0;
  }
  const voltageLimit = GT_VOLTAGE_TIERS.find((entry) => entry.tier === tier)?.maxEuT;
  const amperagePerMachine =
    voltageLimit && Number.isFinite(voltageLimit)
      ? Math.max(1, Math.ceil((eutPerOperation * effectiveParallel) / voltageLimit))
      : 1;
  return amperagePerMachine * machineCount;
}
