import { describe, expect, it } from "vitest";
import { calculateMachineAmperage } from "./power";

describe("machine amperage", () => {
  it("uses one amp for a normal recipe in its voltage tier", () => {
    expect(calculateMachineAmperage(30, "LV", 1, 1)).toBe(1);
  });

  it("accounts for parallel load and machine count", () => {
    expect(calculateMachineAmperage(30, "LV", 2, 4)).toBe(8);
  });

  it("keeps passive recipes at zero amps", () => {
    expect(calculateMachineAmperage(0, "LV", 64, 1)).toBe(0);
  });
});
