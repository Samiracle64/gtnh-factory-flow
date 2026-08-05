import type { FactoryProject } from "@/lib/model/types";
import type { MachineCountOptimizationResult } from "./machine-count-optimizer";

type OptimizerResponse = {
  requestId: string;
  machineCounts: Array<[string, number]>;
  diagnostics: string[];
};

export function canOptimizeInWorker(): boolean {
  return typeof globalThis.Worker !== "undefined";
}

export function optimizeMachineCountsInWorker(
  project: FactoryProject,
): Promise<MachineCountOptimizationResult> {
  return new Promise((resolve, reject) => {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const worker = new Worker(
      new URL("../../workers/machine-count-optimizer.worker.ts", import.meta.url),
      {
        type: "module",
      },
    );
    const timeoutId = globalThis.setTimeout(() => {
      worker.terminate();
      reject(new Error("Machine optimization timed out."));
    }, 30_000);

    worker.onmessage = (event: MessageEvent<OptimizerResponse>) => {
      if (event.data.requestId !== requestId) {
        return;
      }
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
      resolve({
        machineCounts: new Map(event.data.machineCounts),
        diagnostics: event.data.diagnostics,
      });
    };
    worker.onerror = () => {
      globalThis.clearTimeout(timeoutId);
      worker.terminate();
      reject(new Error("Machine optimization worker failed."));
    };
    worker.postMessage({ requestId, project });
  });
}
