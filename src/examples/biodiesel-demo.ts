import biodieselDemoJson from "../../examples/biodiesel-demo.json";
import { migrateFactoryProject } from "@/lib/import-export/factory-json";
import { factoryProjectSchema } from "@/lib/model/schemas";
import type { FactoryProject } from "@/lib/model/types";

export function loadBiodieselDemoProject(): FactoryProject {
  return factoryProjectSchema.parse(migrateFactoryProject(biodieselDemoJson));
}
