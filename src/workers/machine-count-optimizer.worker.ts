import type { FactoryProject } from "@/lib/model/types";
import { optimizeMachineCountsForProject } from "@/lib/solver/machine-count-optimizer";

type OptimizerRequest = { requestId: string; project: FactoryProject };
type OptimizerResponse = {
  requestId: string;
  machineCounts: Array<[string, number]>;
  diagnostics: string[];
};

const workerScope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<OptimizerRequest>) => void) | null;
  postMessage: (message: OptimizerResponse) => void;
};

workerScope.onmessage = (event) => {
  const result = optimizeMachineCountsForProject(event.data.project);
  workerScope.postMessage({
    requestId: event.data.requestId,
    machineCounts: [...result.machineCounts.entries()],
    diagnostics: result.diagnostics,
  });
};

export {};
