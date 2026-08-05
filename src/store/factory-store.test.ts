import { beforeEach, describe, expect, it } from "vitest";
import { PROJECT_SCHEMA_VERSION, type FactoryProject } from "@/lib/model/types";
import { makeResourceHandleId } from "@/components/flow/resource-handles";
import { useFactoryStore } from "./factory-store";

describe("factory resource links", () => {
  beforeEach(() => {
    useFactoryStore.getState().setProject(createLinkTestProject());
  });

  it("connects matching item recipe slots with explicit handles", () => {
    useFactoryStore.getState().connectNodes("item-source", "item-target", {
      kind: "item",
      id: "dust",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
    });

    expect(useFactoryStore.getState().project.edges).toEqual([
      expect.objectContaining({
        source: "item-source",
        target: "item-target",
        sourceHandle: "output:item:dust:0",
        targetHandle: "input:item:dust:0",
        resourceKind: "item",
        resourceId: "dust",
      }),
    ]);
  });

  it("connects concrete item outputs to ore dictionary inputs", () => {
    useFactoryStore.getState().connectNodes("stick-source", "stick-oredict-target", {
      kind: "item",
      id: "minecraft:stick@0",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "minecraft:stick@0" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "oredict:stickWood" }, 0),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "stick-source",
        target: "stick-oredict-target",
        sourceHandle: "output:item:minecraft%3Astick%400:0",
        targetHandle: "input:item:oredict%3AstickWood:0",
        resourceKind: "item",
        resourceId: "minecraft:stick@0",
      }),
    );
  });

  it("stores the concrete connected resource on an ore dictionary input node", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "connected-oredict-override-test",
      name: "Connected oredict override test",
      fuelProfiles: [],
      recipes: [
        {
          id: "tgs",
          name: "Tree Growth Simulator",
          machineType: "Tree Growth Simulator",
          minimumTier: "LV",
          durationTicks: 100,
          eut: 0,
          inputs: [],
          outputs: [
            {
              kind: "item",
              id: "minecraft:log@1",
              amount: 16,
              displayName: "Spruce Log",
              iconPath: "/items/spruce-log.png",
            },
          ],
        },
        {
          id: "coke",
          name: "Coke Oven",
          machineType: "Coke Oven",
          minimumTier: "MV",
          durationTicks: 256,
          eut: 96,
          inputs: [
            {
              kind: "item",
              id: "oredict:logWood",
              amount: 16,
              displayName: "Ore Dictionary: logWood",
              alternatives: [
                {
                  kind: "item",
                  id: "minecraft:log@0",
                  displayName: "Oak Log",
                  iconPath: "/items/oak-log.png",
                },
                {
                  kind: "item",
                  id: "minecraft:log@1",
                  displayName: "Spruce Log",
                  iconPath: "/items/old-spruce-log.png",
                },
              ],
            },
          ],
          outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
        },
      ],
      nodes: [
        {
          id: "tgs-node",
          recipeId: "tgs",
          machineCount: 1,
          parallel: 1,
          overclockTier: "LV",
          enabled: true,
          position: { x: 0, y: 0 },
        },
        {
          id: "coke-node",
          recipeId: "coke",
          machineCount: 1,
          parallel: 1,
          overclockTier: "MV",
          enabled: true,
          position: { x: 400, y: 0 },
        },
      ],
      edges: [],
    });

    useFactoryStore.getState().connectNodes("tgs-node", "coke-node", {
      kind: "item",
      id: "minecraft:log@1",
      displayName: "Spruce Log",
      iconPath: "/items/spruce-log.png",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "minecraft:log@1" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "oredict:logWood" }, 0),
    });

    expect(useFactoryStore.getState().project.nodes[1]?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        id: "minecraft:log@1",
        displayName: "Spruce Log",
        iconPath: "/items/spruce-log.png",
        alternatives: undefined,
      }),
    );
  });

  it("connects explicit concrete handles even when the source recipe output is contextual", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "contextual-output-link-test",
      name: "Contextual output link test",
      fuelProfiles: [],
      recipes: [
        {
          id: "tgs",
          name: "Tree Growth Simulator",
          machineType: "Tree Growth Simulator",
          minimumTier: "LV",
          durationTicks: 100,
          eut: 0,
          inputs: [],
          outputs: [
            {
              kind: "item",
              id: "oredict:logWood",
              amount: 16,
              displayName: "Ore Dictionary: logWood",
              alternatives: [{ kind: "item", id: "minecraft:log@1", displayName: "Spruce Log" }],
            },
          ],
        },
        {
          id: "coke",
          name: "Coke Oven",
          machineType: "Coke Oven",
          minimumTier: "MV",
          durationTicks: 256,
          eut: 96,
          inputs: [
            {
              kind: "item",
              id: "oredict:logWood",
              amount: 16,
              displayName: "Ore Dictionary: logWood",
              alternatives: [{ kind: "item", id: "minecraft:log@1", displayName: "Spruce Log" }],
            },
          ],
          outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
        },
      ],
      nodes: [
        {
          id: "tgs-node",
          recipeId: "tgs",
          machineCount: 1,
          parallel: 1,
          overclockTier: "LV",
          enabled: true,
          position: { x: 0, y: 0 },
        },
        {
          id: "coke-node",
          recipeId: "coke",
          machineCount: 1,
          parallel: 1,
          overclockTier: "MV",
          recipeInputOverrides: {
            "0": {
              kind: "item",
              id: "minecraft:log@1",
              amount: 16,
              displayName: "Spruce Log",
            },
          },
          enabled: true,
          position: { x: 400, y: 0 },
        },
      ],
      edges: [],
    });

    useFactoryStore.getState().connectNodes("tgs-node", "coke-node", {
      kind: "item",
      id: "minecraft:log@1",
      displayName: "Spruce Log",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "minecraft:log@1" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "minecraft:log@1" }, 0),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "tgs-node",
        target: "coke-node",
        resourceKind: "item",
        resourceId: "minecraft:log@1",
        sourceHandle: "output:item:minecraft%3Alog%401:0",
        targetHandle: "input:item:minecraft%3Alog%401:0",
      }),
    );

    useFactoryStore.getState().updateNode("tgs-node", {
      machineConfigTiers: { tgsToolSlot1: "saw" },
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "tgs-node",
        target: "coke-node",
        resourceKind: "item",
        resourceId: "minecraft:log@1",
      }),
    );
  });

  it("connects tool outputs to matching ore dictionary tool inputs", () => {
    useFactoryStore.getState().connectNodes("screwdriver-source", "screwdriver-oredict-target", {
      kind: "item",
      id: "gregtech:screwdriver.lv@0",
      sourceHandle: makeResourceHandleId(
        "output",
        { kind: "item", id: "gregtech:screwdriver.lv@0" },
        0,
      ),
      targetHandle: makeResourceHandleId(
        "input",
        { kind: "item", id: "oredict:craftingToolScrewdriver" },
        0,
      ),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "screwdriver-source",
        target: "screwdriver-oredict-target",
        sourceHandle: "output:item:gregtech%3Ascrewdriver.lv%400:0",
        targetHandle: "input:item:oredict%3AcraftingToolScrewdriver:0",
        resourceKind: "item",
        resourceId: "gregtech:screwdriver.lv@0",
      }),
    );
  });

  it("connects concrete item drawers to ore dictionary inputs", () => {
    useFactoryStore.getState().connectNodes("stick-drawer", "stick-oredict-target", {
      kind: "item",
      id: "minecraft:stick@0",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "minecraft:stick@0" }),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "oredict:stickWood" }, 0),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "stick-drawer",
        target: "stick-oredict-target",
        resourceKind: "item",
        resourceId: "minecraft:stick@0",
      }),
    );
  });

  it("connects matching fluid recipe slots with explicit handles", () => {
    useFactoryStore.getState().connectNodes("fluid-source", "fluid-target", {
      kind: "fluid",
      id: "water",
      sourceHandle: makeResourceHandleId("output", { kind: "fluid", id: "water" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "water" }, 0),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "fluid-source",
        target: "fluid-target",
        sourceHandle: "output:fluid:water:0",
        targetHandle: "input:fluid:water:0",
        resourceKind: "fluid",
        resourceId: "water",
      }),
    );
  });

  it("refuses mismatched item and fluid resources", () => {
    useFactoryStore.getState().connectNodes("item-source", "fluid-target", {
      kind: "item",
      id: "dust",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "water" }, 0),
    });

    expect(useFactoryStore.getState().project.edges).toHaveLength(0);
  });

  it("connects recipe outputs into matching drawers or tanks", () => {
    useFactoryStore.getState().connectNodes("fluid-source", "water-tank", {
      kind: "fluid",
      id: "water",
      sourceHandle: makeResourceHandleId("output", { kind: "fluid", id: "water" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "water" }),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "fluid-source",
        target: "water-tank",
        targetHandle: "input:fluid:water",
        resourceKind: "fluid",
        resourceId: "water",
      }),
    );
  });

  it("connects matching drawers or tanks into recipe inputs", () => {
    useFactoryStore.getState().connectNodes("dust-drawer", "item-target", {
      kind: "item",
      id: "dust",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "dust-drawer",
        target: "item-target",
        sourceHandle: "output:item:dust",
        resourceKind: "item",
        resourceId: "dust",
      }),
    );
  });

  it("does not create multiple storage cards from the same recipe slot", () => {
    const store = useFactoryStore.getState();
    store.addStorageForConnection(
      { kind: "item", id: "dust", displayName: "Dust" },
      "item-source",
      "output",
      { x: 320, y: 20 },
      makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
    );
    store.addStorageForConnection(
      { kind: "item", id: "dust", displayName: "Dust" },
      "item-source",
      "output",
      { x: 420, y: 20 },
      makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
    );

    const dustStorages =
      useFactoryStore
        .getState()
        .project.storages?.filter((storage) => storage.resourceId === "dust") ?? [];
    const createdDustStorages = dustStorages.filter((storage) => storage.id !== "dust-drawer");

    expect(createdDustStorages).toHaveLength(1);
    expect(useFactoryStore.getState().project.edges).toHaveLength(1);
    expect(useFactoryStore.getState().project.edges[0]?.target).toBe(createdDustStorages[0]?.id);
  });

  it("allows separate storage cards for the same resource on different recipe slots", () => {
    const store = useFactoryStore.getState();
    store.addStorageForConnection(
      { kind: "item", id: "dust", displayName: "Dust" },
      "item-source",
      "output",
      { x: 320, y: 20 },
      makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
    );
    store.addStorageForConnection(
      { kind: "item", id: "dust", displayName: "Dust" },
      "item-target",
      "input",
      { x: 420, y: 20 },
      makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
    );

    const createdDustStorages =
      useFactoryStore
        .getState()
        .project.storages?.filter((storage) => storage.resourceId === "dust")
        .filter((storage) => storage.id !== "dust-drawer") ?? [];

    expect(createdDustStorages).toHaveLength(2);
    expect(useFactoryStore.getState().project.edges).toHaveLength(2);
  });

  it("creates a fluid tank when dragging a filled cell input into storage", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "filled-cell-storage-test",
      name: "Filled cell storage test",
      fuelProfiles: [],
      recipes: [
        {
          id: "cell-consumer",
          name: "Cell Consumer",
          machineType: "Assembler",
          minimumTier: "LV",
          durationTicks: 20,
          eut: 1,
          inputs: [
            {
              kind: "item",
              id: "gregtech:gt.metaitem.99@143",
              amount: 2,
              displayName: "Molten Magmatter Cell",
              alternatives: [
                {
                  kind: "fluid",
                  id: "molten.magmatter",
                  displayName: "Molten Magmatter",
                  amount: 144,
                },
              ],
            },
          ],
          outputs: [{ kind: "item", id: "plate", amount: 1 }],
        },
      ],
      nodes: [makeNode("cell-consumer-node", "cell-consumer", 0)],
      storages: [],
      edges: [],
    });

    useFactoryStore.getState().addStorageForConnection(
      {
        kind: "item",
        id: "gregtech:gt.metaitem.99@143",
        amount: 2,
        displayName: "Molten Magmatter Cell",
        alternatives: [
          {
            kind: "fluid",
            id: "molten.magmatter",
            displayName: "Molten Magmatter",
            amount: 144,
          },
        ],
      },
      "cell-consumer-node",
      "input",
      { x: 320, y: 20 },
      makeResourceHandleId("input", { kind: "item", id: "gregtech:gt.metaitem.99@143" }, 0),
    );

    const state = useFactoryStore.getState();
    expect(state.project.storages?.[0]).toEqual(
      expect.objectContaining({
        kind: "fluid",
        resourceId: "molten.magmatter",
        displayName: "Molten Magmatter",
      }),
    );
    expect(state.project.edges[0]).toEqual(
      expect.objectContaining({
        source: state.project.storages?.[0]?.id,
        target: "cell-consumer-node",
        resourceKind: "fluid",
        resourceId: "molten.magmatter",
        targetHandle: "input:item:gregtech%3Agt.metaitem.99%40143:0",
      }),
    );
    expect(state.project.nodes[0]?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        kind: "fluid",
        id: "molten.magmatter",
        amount: 288,
        displayName: "Molten Magmatter",
      }),
    );
  });

  it("connects a new drawer to an overridden concrete recipe input", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "overridden-input-storage-link",
      name: "Overridden input storage link",
      fuelProfiles: [],
      recipes: [
        {
          id: "pyro",
          name: "Pyrolyse Oven: Charcoal",
          machineType: "Pyrolyse Oven",
          minimumTier: "MV",
          durationTicks: 320,
          eut: 96,
          inputs: [
            {
              kind: "item",
              id: "minecraft:log@32767",
              amount: 16,
              displayName: "Oak Log",
            },
          ],
          outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
        },
      ],
      nodes: [
        {
          id: "pyro-node",
          recipeId: "pyro",
          machineCount: 1,
          parallel: 1,
          overclockTier: "MV",
          recipeInputOverrides: {
            "0": {
              kind: "item",
              id: "minecraft:log@1",
              amount: 16,
              displayName: "Spruce Log",
            },
          },
          enabled: true,
          position: { x: 0, y: 0 },
        },
      ],
      storages: [],
      edges: [],
    });

    useFactoryStore
      .getState()
      .addStorageForConnection(
        { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log" },
        "pyro-node",
        "input",
        { x: 220, y: 0 },
        makeResourceHandleId("input", { kind: "item", id: "minecraft:log@1" }, 0),
      );

    const project = useFactoryStore.getState().project;
    expect(project.storages).toEqual([
      expect.objectContaining({
        kind: "item",
        resourceId: "minecraft:log@1",
        displayName: "Spruce Log",
      }),
    ]);
    expect(project.edges).toEqual([
      expect.objectContaining({
        source: project.storages?.[0]?.id,
        target: "pyro-node",
        sourceHandle: "output:item:minecraft%3Alog%401",
        targetHandle: "input:item:minecraft%3Alog%401:0",
        resourceKind: "item",
        resourceId: "minecraft:log@1",
        label: "Spruce Log",
      }),
    ]);
  });

  it("does not connect storage to non-consumed recipe inputs", () => {
    useFactoryStore.getState().connectNodes("mold-drawer", "nc-target", {
      kind: "item",
      id: "mold",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "mold" }),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "mold" }, 0),
    });

    expect(useFactoryStore.getState().project.edges).toHaveLength(0);
  });

  it("connects pending fluid slots regardless of click order", () => {
    const store = useFactoryStore.getState();
    store.selectResourceConnectionSlot({
      nodeId: "fluid-target",
      side: "input",
      kind: "fluid",
      resourceId: "water",
      displayName: "Water",
      handleId: makeResourceHandleId("input", { kind: "fluid", id: "water" }, 0),
    });
    useFactoryStore.getState().selectResourceConnectionSlot({
      nodeId: "fluid-source",
      side: "output",
      kind: "fluid",
      resourceId: "water",
      displayName: "Water",
      handleId: makeResourceHandleId("output", { kind: "fluid", id: "water" }, 0),
    });

    expect(useFactoryStore.getState().project.edges[0]).toEqual(
      expect.objectContaining({
        source: "fluid-source",
        target: "fluid-target",
        resourceKind: "fluid",
        resourceId: "water",
      }),
    );
  });

  it("removes an existing resource edge when the same slots are linked again", () => {
    const firstSlot = {
      nodeId: "item-source",
      side: "output" as const,
      kind: "item" as const,
      resourceId: "dust",
      displayName: "Dust",
      handleId: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
    };
    const secondSlot = {
      nodeId: "item-target",
      side: "input" as const,
      kind: "item" as const,
      resourceId: "dust",
      displayName: "Dust",
      handleId: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
    };

    useFactoryStore.getState().selectResourceConnectionSlot(firstSlot);
    useFactoryStore.getState().selectResourceConnectionSlot(secondSlot);
    expect(useFactoryStore.getState().project.edges).toHaveLength(1);

    useFactoryStore.getState().selectResourceConnectionSlot(firstSlot);
    useFactoryStore.getState().selectResourceConnectionSlot(secondSlot);
    expect(useFactoryStore.getState().project.edges).toHaveLength(0);
  });

  it("removes an orphan drawer or tank when its last edge is deleted", () => {
    useFactoryStore.getState().connectNodes("fluid-source", "water-tank", {
      kind: "fluid",
      id: "water",
      sourceHandle: makeResourceHandleId("output", { kind: "fluid", id: "water" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "water" }),
    });
    const edgeId = useFactoryStore.getState().project.edges[0]?.id;
    expect(useFactoryStore.getState().project.storages).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "water-tank" })]),
    );

    useFactoryStore.getState().deleteEdge(edgeId);

    expect(useFactoryStore.getState().project.edges).toHaveLength(0);
    expect(useFactoryStore.getState().project.storages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "water-tank" })]),
    );
  });

  it("undoes and redoes structural project edits", () => {
    useFactoryStore.getState().connectNodes("item-source", "item-target", {
      kind: "item",
      id: "dust",
      sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
    });
    expect(useFactoryStore.getState().project.edges).toHaveLength(1);

    useFactoryStore.getState().undo();
    expect(useFactoryStore.getState().project.edges).toHaveLength(0);

    useFactoryStore.getState().redo();
    expect(useFactoryStore.getState().project.edges).toHaveLength(1);
  });

  it("coalesces rapid visual movement into one undo snapshot", () => {
    const originalPosition = useFactoryStore
      .getState()
      .project.nodes.find((node) => node.id === "item-source")?.position;

    useFactoryStore.getState().setNodePosition("item-source", { x: 120, y: 80 });
    useFactoryStore.getState().setNodePosition("item-source", { x: 180, y: 140 });

    expect(useFactoryStore.getState().undoHistory).toHaveLength(1);
    useFactoryStore.getState().undo();
    expect(
      useFactoryStore.getState().project.nodes.find((node) => node.id === "item-source")?.position,
    ).toEqual(originalPosition);
  });

  it("clears redo history after a new edit", () => {
    useFactoryStore.getState().updateNode("item-source", { machineCount: 4 });
    useFactoryStore.getState().undo();
    expect(useFactoryStore.getState().redoHistory).toHaveLength(1);

    useFactoryStore.getState().updateNode("item-source", { overclockTier: "HV" });

    expect(useFactoryStore.getState().redoHistory).toHaveLength(0);
    expect(
      useFactoryStore.getState().project.nodes.find((node) => node.id === "item-source")
        ?.overclockTier,
    ).toBe("HV");
  });

  it("removes storage links when a node is changed to a recipe that no longer references it", () => {
    useFactoryStore.getState().connectNodes("fluid-source", "water-tank", {
      kind: "fluid",
      id: "water",
      sourceHandle: makeResourceHandleId("output", { kind: "fluid", id: "water" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "water" }),
    });

    useFactoryStore.getState().updateNode("fluid-source", { recipeId: "item-source-recipe" });

    expect(useFactoryStore.getState().project.edges).toHaveLength(0);
    expect(useFactoryStore.getState().project.storages).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "water-tank" })]),
    );
  });

  it("links a sodium to NaK coolant fluid chain without creating storage", () => {
    useFactoryStore.getState().setProject(createNakCoolantProject());

    useFactoryStore.getState().connectNodes("fluid-heater", "distillery", {
      kind: "fluid",
      id: "liquid_sodium",
      sourceHandle: makeResourceHandleId("output", { kind: "fluid", id: "liquid_sodium" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "liquid_sodium" }, 1),
    });
    useFactoryStore.getState().connectNodes("distillery", "fluid-canner", {
      kind: "fluid",
      id: "sodium_potassium",
      sourceHandle: makeResourceHandleId("output", { kind: "fluid", id: "sodium_potassium" }, 0),
      targetHandle: makeResourceHandleId("input", { kind: "fluid", id: "sodium_potassium" }, 1),
    });

    expect(useFactoryStore.getState().project.storages).toHaveLength(0);
    expect(useFactoryStore.getState().project.edges).toEqual([
      expect.objectContaining({
        source: "fluid-heater",
        target: "distillery",
        resourceKind: "fluid",
        resourceId: "liquid_sodium",
      }),
      expect.objectContaining({
        source: "distillery",
        target: "fluid-canner",
        resourceKind: "fluid",
        resourceId: "sodium_potassium",
      }),
    ]);
  });
});

describe("project recipe refresh", () => {
  it("replaces stale machine handlers from the loaded dataset recipe", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "refresh-test",
      name: "Refresh test",
      fuelProfiles: [],
      recipes: [
        {
          id: "fluid-extractor-recipe",
          name: "Fluid Extractor: Charcoal",
          machineType: "Fluid Extractor",
          minimumTier: "LV",
          durationTicks: 30,
          eut: 16,
          inputs: [{ kind: "item", id: "minecraft:coal@1", amount: 1 }],
          outputs: [{ kind: "fluid", id: "woodtar", amount: 100 }],
          machineHandlers: [
            {
              id: "nei-catalyst-basic-fluid-extractor",
              label: "Basic Fluid Extractor",
              machineType: "Basic Fluid Extractor",
              minimumTier: "LV",
              kind: "single",
            },
          ],
        },
      ],
      nodes: [
        {
          id: "node-1",
          recipeId: "fluid-extractor-recipe",
          machineCount: 1,
          parallel: 1,
          overclockTier: "LV",
          machineHandlerId: "nei-catalyst-basic-fluid-extractor",
          enabled: true,
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });

    useFactoryStore.getState().refreshProjectRecipes([
      {
        id: "fluid-extractor-recipe",
        name: "Fluid Extractor: Charcoal",
        machineType: "Fluid Extractor",
        minimumTier: "LV",
        durationTicks: 30,
        eut: 16,
        inputs: [{ kind: "item", id: "minecraft:coal@1", amount: 1 }],
        outputs: [{ kind: "fluid", id: "woodtar", amount: 100 }],
      },
    ]);

    expect(useFactoryStore.getState().project.recipes[0]?.machineHandlers).toBeUndefined();
    expect(useFactoryStore.getState().project.nodes[0]?.machineHandlerId).toBeUndefined();
  });

  it("moves a legacy concrete ore dictionary input from the recipe to the node", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "refresh-context-test",
      name: "Refresh context test",
      fuelProfiles: [],
      recipes: [
        {
          id: "coke-oven-log",
          name: "Coke Oven: Charcoal",
          machineType: "Coke Oven",
          minimumTier: "MV",
          durationTicks: 256,
          eut: 96,
          inputs: [
            {
              kind: "item",
              id: "minecraft:log@1",
              amount: 16,
              displayName: "Spruce Log",
            },
          ],
          outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
        },
      ],
      nodes: [
        {
          id: "node-1",
          recipeId: "coke-oven-log",
          machineCount: 1,
          parallel: 1,
          overclockTier: "MV",
          enabled: true,
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });

    useFactoryStore.getState().refreshProjectRecipes([
      {
        id: "coke-oven-log",
        name: "Coke Oven: Charcoal",
        machineType: "Coke Oven",
        minimumTier: "MV",
        durationTicks: 256,
        eut: 96,
        inputs: [
          {
            kind: "item",
            id: "oredict:logWood",
            amount: 16,
            displayName: "Oak Log",
            alternatives: [{ kind: "item", id: "minecraft:log@1" }],
          },
        ],
        outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
      },
    ]);

    expect(useFactoryStore.getState().project.recipes[0]?.inputs[0]).toEqual(
      expect.objectContaining({
        id: "oredict:logWood",
        alternatives: [{ kind: "item", id: "minecraft:log@1" }],
      }),
    );
    expect(useFactoryStore.getState().project.nodes[0]?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        id: "minecraft:log@1",
        displayName: "Spruce Log",
        alternatives: undefined,
      }),
    );
  });

  it("keeps the shared recipe generic when adding a concrete uses node", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "add-context-test",
      name: "Add context test",
      fuelProfiles: [],
      recipes: [],
      nodes: [],
      edges: [],
    });

    useFactoryStore.getState().addNodeForRecipeObject(
      {
        id: "coke-oven-log",
        name: "Coke Oven: Charcoal",
        machineType: "Coke Oven",
        minimumTier: "MV",
        durationTicks: 256,
        eut: 96,
        inputs: [
          {
            kind: "item",
            id: "oredict:logWood",
            amount: 16,
            displayName: "Ore Dictionary: logWood",
            alternatives: [
              { kind: "item", id: "minecraft:log@0", displayName: "Oak Log" },
              { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log" },
            ],
          },
        ],
        outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
      },
      { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log", mode: "uses" },
    );

    expect(useFactoryStore.getState().project.recipes[0]?.inputs[0]).toEqual(
      expect.objectContaining({
        id: "oredict:logWood",
        displayName: "Ore Dictionary: logWood",
      }),
    );
    expect(useFactoryStore.getState().project.nodes[0]?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        id: "minecraft:log@1",
        displayName: "Spruce Log",
        alternatives: undefined,
      }),
    );
  });

  it("stores concrete input context even when the browser mode is not uses", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "add-context-mode-test",
      name: "Add context mode test",
      fuelProfiles: [],
      recipes: [],
      nodes: [],
      edges: [],
    });

    useFactoryStore.getState().addNodeForRecipeObject(
      {
        id: "coke-oven-log",
        name: "Coke Oven: Charcoal",
        machineType: "Coke Oven",
        minimumTier: "MV",
        durationTicks: 256,
        eut: 96,
        inputs: [
          {
            kind: "item",
            id: "oredict:logWood",
            amount: 16,
            displayName: "Ore Dictionary: logWood",
            alternatives: [
              { kind: "item", id: "minecraft:log@0", displayName: "Oak Log" },
              { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log" },
            ],
          },
        ],
        outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
      },
      { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log", mode: "recipes" },
    );

    expect(useFactoryStore.getState().project.nodes[0]?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        id: "minecraft:log@1",
        displayName: "Spruce Log",
        alternatives: undefined,
      }),
    );
  });

  it("stores concrete uses inputs on connected recipe nodes", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "connected-context-test",
      name: "Connected context test",
      fuelProfiles: [],
      recipes: [
        {
          id: "drawer-source",
          name: "Drawer",
          machineType: "Drawer",
          minimumTier: "NONE",
          durationTicks: 20,
          eut: 0,
          inputs: [],
          outputs: [{ kind: "item", id: "minecraft:log@1", amount: 1, displayName: "Spruce Log" }],
        },
      ],
      nodes: [
        {
          id: "source-node",
          recipeId: "drawer-source",
          machineCount: 1,
          parallel: 1,
          overclockTier: "NONE",
          enabled: true,
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });

    useFactoryStore.getState().addConnectedNodeForRecipeObject(
      {
        id: "coke-oven-log",
        name: "Coke Oven: Charcoal",
        machineType: "Coke Oven",
        minimumTier: "MV",
        durationTicks: 256,
        eut: 96,
        inputs: [
          {
            kind: "item",
            id: "minecraft:log@1",
            amount: 16,
            displayName: "Spruce Log",
          },
        ],
        outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
      },
      "source-node",
      { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log", mode: "uses" },
    );

    const node = useFactoryStore
      .getState()
      .project.nodes.find((entry) => entry.recipeId === "coke-oven-log");

    expect(node?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        id: "minecraft:log@1",
        displayName: "Spruce Log",
        alternatives: undefined,
      }),
    );
  });

  it("stores concrete uses inputs when the recipe input is an ore dictionary alternative", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "connected-oredict-context-test",
      name: "Connected oredict context test",
      fuelProfiles: [],
      recipes: [
        {
          id: "drawer-source",
          name: "Drawer",
          machineType: "Drawer",
          minimumTier: "NONE",
          durationTicks: 20,
          eut: 0,
          inputs: [],
          outputs: [{ kind: "item", id: "minecraft:log@1", amount: 1, displayName: "Spruce Log" }],
        },
      ],
      nodes: [
        {
          id: "source-node",
          recipeId: "drawer-source",
          machineCount: 1,
          parallel: 1,
          overclockTier: "NONE",
          enabled: true,
          position: { x: 0, y: 0 },
        },
      ],
      edges: [],
    });

    useFactoryStore.getState().addConnectedNodeForRecipeObject(
      {
        id: "coke-oven-log",
        name: "Coke Oven: Charcoal",
        machineType: "Coke Oven",
        minimumTier: "MV",
        durationTicks: 256,
        eut: 96,
        inputs: [
          {
            kind: "item",
            id: "oredict:logWood",
            amount: 16,
            displayName: "Ore Dictionary: logWood",
            alternatives: [
              { kind: "item", id: "minecraft:log@0", displayName: "Oak Log" },
              { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log" },
            ],
          },
        ],
        outputs: [{ kind: "item", id: "minecraft:coal@1", amount: 20 }],
      },
      "source-node",
      { kind: "item", id: "minecraft:log@1", displayName: "Spruce Log", mode: "uses" },
    );

    const node = useFactoryStore
      .getState()
      .project.nodes.find((entry) => entry.recipeId === "coke-oven-log");

    expect(node?.recipeInputOverrides?.["0"]).toEqual(
      expect.objectContaining({
        kind: "item",
        id: "minecraft:log@1",
        displayName: "Spruce Log",
        alternatives: undefined,
      }),
    );
  });
});

describe("factory machine count optimization", () => {
  it("propagates suggested machine counts through connected recipe chains", () => {
    useFactoryStore.getState().setProject(createRatioOptimizationProject());

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dust-source", machineCount: 10 }),
        expect.objectContaining({ id: "plate-target", machineCount: 10 }),
      ]),
    );
  });

  it("normalizes every optimized machine count to an integer", () => {
    const project = createRatioOptimizationProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "dust-source" ? { ...node, machineCount: 1.6 } : node,
      ),
      edges: [],
    });

    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.every((node) => Number.isInteger(node.machineCount)),
    ).toBe(true);
  });

  it("rounds optimized machine counts up to keep logistical surplus", () => {
    const project = createRatioOptimizationProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "plate-target"
          ? {
              ...node,
              targetOutput: {
                kind: "item",
                resourceId: "plate",
                amountPerSecond: 1.4,
              },
            }
          : node,
      ),
    });

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dust-source", machineCount: 2 }),
        expect.objectContaining({ id: "plate-target", machineCount: 2 }),
      ]),
    );
    expect(useFactoryStore.getState().lastResult.externalInputs).toHaveLength(0);
  });

  it("does not amplify cyclic recipe chains across optimization passes", () => {
    useFactoryStore.getState().setProject(createCyclicRatioProject());

    useFactoryStore.getState().optimizeMachineCounts();

    const machineCounts = useFactoryStore.getState().project.nodes.map((node) => node.machineCount);

    expect(machineCounts.every((machineCount) => Number.isInteger(machineCount))).toBe(true);
    expect(Math.max(...machineCounts)).toBeLessThanOrEqual(2);
  });

  it("balances stable direct recipe cycles without an explicit target", () => {
    useFactoryStore.getState().setProject(createStableDirectCycleOptimizationProject());

    useFactoryStore.getState().optimizeMachineCounts();
    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "cycle-ingot-to-nuggets", machineCount: 1 }),
        expect.objectContaining({ id: "cycle-nuggets-to-ingot", machineCount: 2 }),
      ]),
    );
  });

  it("does not amplify cycles connected through separate buses for the same resource", () => {
    useFactoryStore.getState().setProject(createStorageBusCycleProject());

    useFactoryStore.getState().optimizeMachineCounts();
    useFactoryStore.getState().optimizeMachineCounts();
    useFactoryStore.getState().optimizeMachineCounts();

    const machineCounts = useFactoryStore.getState().project.nodes.map((node) => node.machineCount);

    expect(machineCounts.every((machineCount) => Number.isInteger(machineCount))).toBe(true);
    expect(Math.max(...machineCounts)).toBeLessThanOrEqual(2);
  });

  it("keeps cyclic SCC optimization bounded from external demand", () => {
    const project = createSmallCyclicBottleneckProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "small-cycle-source"
          ? { ...node, machineCount: 50 }
          : { ...node, machineCount: 51 },
      ),
    });

    useFactoryStore.getState().optimizeMachineCount("small-cycle-source");

    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().optimizeMachineCount("small-cycle-source");

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
    expect(
      Math.max(...useFactoryStore.getState().project.nodes.map((node) => node.machineCount)),
    ).toBeLessThanOrEqual(51);
  });

  it("sizes internal suppliers in catalyst loops from downstream demand", () => {
    useFactoryStore.getState().setProject(createCatalystLoopOptimizationProject());

    useFactoryStore.getState().optimizeMachineCounts();
    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "loop-compressor", machineCount: 5 }),
        expect.objectContaining({ id: "loop-centrifuge", machineCount: 1 }),
        expect.objectContaining({ id: "loop-canner", machineCount: 1 }),
        expect.objectContaining({ id: "loop-terminal", machineCount: 1 }),
      ]),
    );
  });

  it("keeps global optimization idempotent across repeated clicks", () => {
    useFactoryStore.getState().setProject(createStorageBusCycleProject());

    useFactoryStore.getState().optimizeMachineCounts();
    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().optimizeMachineCounts();
    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
  });

  it("ignores placeholder machine counts during global optimization", () => {
    const project = createAcyclicStorageBusProject();
    const placeholderProject = {
      ...project,
      nodes: project.nodes.map((node) => ({
        ...node,
        machineCount: node.id === "bus-source" ? 999 : 37,
      })),
    };

    useFactoryStore.getState().setProject(project);
    useFactoryStore.getState().optimizeMachineCounts();
    const baselineCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().setProject(placeholderProject);
    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(baselineCounts);
  });

  it("does not count pure storage sinks as extra ratio demand", () => {
    useFactoryStore.getState().setProject(createRecipeChainWithStorageSinkProject());

    useFactoryStore.getState().optimizeMachineCounts();
    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "sink-source", machineCount: 10 }),
        expect.objectContaining({ id: "sink-target", machineCount: 10 }),
      ]),
    );
  });

  it("does not let surplus storage sinks pin single-node optimization to the current count", () => {
    const project = createRecipeChainWithStorageSinkProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "sink-source"
          ? { ...node, machineCount: 3 }
          : {
              ...node,
              targetOutput: {
                kind: "item",
                resourceId: "plate",
                amountPerSecond: 1,
              },
            },
      ),
    });

    useFactoryStore.getState().optimizeMachineCount("sink-source");

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "sink-source", machineCount: 1 })]),
    );
  });

  it("uses the split share when storage and another edge feed the same input", () => {
    const project = createSplitStorageInputOptimizationProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "storage-source" ? { ...node, machineCount: 10 } : node,
      ),
    });

    useFactoryStore.getState().optimizeMachineCount("storage-source");

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "storage-source", machineCount: 1 })]),
    );
  });

  it("optimizes a multi-output producer when one output is split through storage", () => {
    const project = createMultiOutputSplitInputOptimizationProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "source" ? { ...node, machineCount: 41 } : node,
      ),
    });

    useFactoryStore.getState().optimizeMachineCount("source");

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "source", machineCount: 1 })]),
    );
  });

  it("sizes upstream inputs from downstream storage demand instead of storage surplus", () => {
    const project = createSurplusStorageConsumerInputProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "input-source" ? { ...node, machineCount: 100 } : node,
      ),
      targetRate: {
        kind: "fluid",
        resourceId: "benzene",
        amountPerSecond: 1,
      },
    });

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "input-source", machineCount: 1 }),
        expect.objectContaining({ id: "storage-producer", machineCount: 1 }),
      ]),
    );
  });

  it("optimizes filled-cell producers connected to fluid storage consumers", () => {
    useFactoryStore.getState().setProject({
      schemaVersion: PROJECT_SCHEMA_VERSION,
      id: "filled-cell-fluid-storage-optimization",
      name: "Filled cell fluid storage optimization",
      recipes: [
        {
          id: "oxygen-cell-source",
          name: "Oxygen Cell Source",
          machineType: "Dehydrator",
          minimumTier: "LV",
          durationTicks: 196,
          eut: 16,
          inputs: [{ kind: "item", id: "empty_cell", amount: 14, displayName: "Empty Cell" }],
          outputs: [{ kind: "item", id: "oxygen_cell", amount: 14, displayName: "Oxygen Cell" }],
        },
        {
          id: "oxygen-consumer",
          name: "Oxygen Consumer",
          machineType: "Chemical Reactor",
          minimumTier: "LV",
          durationTicks: 160,
          eut: 30,
          inputs: [{ kind: "fluid", id: "oxygen", amount: 1000, displayName: "Oxygen" }],
          outputs: [{ kind: "item", id: "empty_cell", amount: 1, displayName: "Empty Cell" }],
        },
      ],
      nodes: [
        { ...makeNode("oxygen-cell-source-node", "oxygen-cell-source", 0), machineCount: 1 },
        { ...makeNode("oxygen-consumer-node", "oxygen-consumer", 220), machineCount: 12 },
      ],
      storages: [
        {
          id: "oxygen-tank",
          kind: "fluid",
          resourceId: "oxygen",
          displayName: "Oxygen",
          position: { x: 120, y: 0 },
        },
      ],
      edges: [
        {
          id: "oxygen-cell-to-tank",
          source: "oxygen-cell-source-node",
          target: "oxygen-tank",
          resourceKind: "fluid",
          resourceId: "oxygen",
          label: "Oxygen Cell",
        },
        {
          id: "oxygen-tank-to-consumer",
          source: "oxygen-tank",
          target: "oxygen-consumer-node",
          resourceKind: "fluid",
          resourceId: "oxygen",
          label: "Oxygen",
        },
      ],
      fuelProfiles: [],
    });

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "oxygen-cell-source-node", machineCount: 1 }),
        expect.objectContaining({ id: "oxygen-consumer-node", machineCount: 11 }),
      ]),
    );
  });

  it("scales terminal consumers to consume produced output when no explicit target exists", () => {
    useFactoryStore.getState().setProject(createImplicitTerminalStorageDemandProject());

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "implicit-source", machineCount: 1 }),
        expect.objectContaining({ id: "implicit-consumer", machineCount: 10 }),
      ]),
    );
  });

  it("uses rounded storage producer capacity for implicit terminal ratios", () => {
    const project = createImplicitRoundedStorageProducerProject();
    useFactoryStore.getState().setProject({
      ...project,
      nodes: project.nodes.map((node) =>
        node.id === "storage-consumer"
          ? {
              ...node,
              machineCount: 100,
            }
          : node,
      ),
    });

    useFactoryStore.getState().optimizeMachineCounts();
    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);
    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "storage-producer", machineCount: 1 }),
        expect.objectContaining({ id: "storage-consumer", machineCount: 3 }),
      ]),
    );
  });

  it("scales producers to fill one configured parallel terminal consumer", () => {
    useFactoryStore.getState().setProject(createImplicitParallelTerminalStorageDemandProject());

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "parallel-source", machineCount: 256 }),
        expect.objectContaining({ id: "parallel-consumer", machineCount: 1 }),
      ]),
    );
  });

  it("stabilizes rounded implicit source output in one click", () => {
    useFactoryStore.getState().setProject(createImplicitRoundedSourceProject());

    useFactoryStore.getState().optimizeMachineCounts();
    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "rounded-source", machineCount: 4 }),
        expect.objectContaining({ id: "rounded-producer", machineCount: 20 }),
        expect.objectContaining({ id: "rounded-indirect", machineCount: 20 }),
        expect.objectContaining({ id: "rounded-terminal", machineCount: 1 }),
      ]),
    );
  });

  it("combines direct and indirect storage output for implicit terminal demand", () => {
    useFactoryStore.getState().setProject(createImplicitDirectAndIndirectStorageOutputProject());

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "implicit-coke", machineCount: 1 }),
        expect.objectContaining({ id: "implicit-extractor", machineCount: 3 }),
        expect.objectContaining({ id: "implicit-distillation", machineCount: 5 }),
      ]),
    );
  });

  it("combines direct and indirect storage output when optimizing a shared producer", () => {
    useFactoryStore.getState().setProject(createDirectAndIndirectStorageOutputProject());

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "coke-oven", machineCount: 1 }),
        expect.objectContaining({ id: "fluid-extractor", machineCount: 1 }),
        expect.objectContaining({ id: "distillation-tower", machineCount: 1 }),
      ]),
    );
  });

  it("uses the global solver result for single-node optimization", () => {
    const project = createDirectAndIndirectStorageOutputProject();
    useFactoryStore.getState().setProject(project);
    useFactoryStore.getState().optimizeMachineCounts();
    const globalCokeCount = useFactoryStore
      .getState()
      .project.nodes.find((node) => node.id === "coke-oven")?.machineCount;

    useFactoryStore.getState().setProject(project);
    useFactoryStore.getState().optimizeMachineCount("coke-oven");

    expect(
      useFactoryStore.getState().project.nodes.find((node) => node.id === "coke-oven")
        ?.machineCount,
    ).toBe(globalCokeCount);
  });

  it("does not amplify an externally seeded recipe cycle", () => {
    useFactoryStore.getState().setProject(createAmplifyingCycleProject());

    useFactoryStore.getState().optimizeMachineCounts();
    const firstCounts = useFactoryStore
      .getState()
      .project.nodes.map((node) => [node.id, node.machineCount]);

    useFactoryStore.getState().optimizeMachineCounts();

    expect(
      useFactoryStore.getState().project.nodes.map((node) => [node.id, node.machineCount]),
    ).toEqual(firstCounts);
    expect(
      Math.max(...useFactoryStore.getState().project.nodes.map((node) => node.machineCount)),
    ).toBeLessThanOrEqual(10);
  });

  it("keeps single-node optimization idempotent across repeated clicks", () => {
    useFactoryStore.getState().setProject(createStorageBusCycleProject());

    useFactoryStore.getState().optimizeMachineCount("bus-cycle-b");
    const firstCount = useFactoryStore
      .getState()
      .project.nodes.find((node) => node.id === "bus-cycle-b")?.machineCount;

    useFactoryStore.getState().optimizeMachineCount("bus-cycle-b");
    useFactoryStore.getState().optimizeMachineCount("bus-cycle-b");

    expect(
      useFactoryStore.getState().project.nodes.find((node) => node.id === "bus-cycle-b")
        ?.machineCount,
    ).toBe(firstCount);
  });

  it("still propagates ratios through separate buses when there is no feedback loop", () => {
    useFactoryStore.getState().setProject(createAcyclicStorageBusProject());

    useFactoryStore.getState().optimizeMachineCounts();

    expect(useFactoryStore.getState().project.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "bus-source", machineCount: 10 }),
        expect.objectContaining({ id: "bus-target", machineCount: 10 }),
      ]),
    );
  });
});

function createLinkTestProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "link-test",
    name: "Link test",
    recipes: [
      {
        id: "item-source-recipe",
        name: "Item source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "dust", amount: 1 }],
      },
      {
        id: "item-target-recipe",
        name: "Item target",
        machineType: "Target",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "dust", amount: 1 }],
        outputs: [{ kind: "item", id: "plate", amount: 1 }],
      },
      {
        id: "fluid-source-recipe",
        name: "Fluid source",
        machineType: "Pump",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "fluid", id: "water", amount: 1000 }],
      },
      {
        id: "fluid-target-recipe",
        name: "Fluid target",
        machineType: "Canner",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "water", amount: 1000 }],
        outputs: [{ kind: "item", id: "cell", amount: 1 }],
      },
      {
        id: "nc-target-recipe",
        name: "Non consumed target",
        machineType: "Extruder",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "mold", amount: 1, consumed: false }],
        outputs: [{ kind: "item", id: "gear", amount: 1 }],
      },
      {
        id: "stick-source-recipe",
        name: "Stick source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "minecraft:stick@0", amount: 1, displayName: "Stick" }],
      },
      {
        id: "stick-oredict-target-recipe",
        name: "Ore dictionary target",
        machineType: "Crafting",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [
          {
            kind: "item",
            id: "oredict:stickWood",
            amount: 1,
            displayName: "Stick",
            alternatives: [
              { kind: "item", id: "minecraft:stick@0", displayName: "Stick" },
              { kind: "item", id: "other:stick@0", displayName: "Other Stick" },
            ],
          },
        ],
        outputs: [{ kind: "item", id: "crafted", amount: 1 }],
      },
      {
        id: "screwdriver-source-recipe",
        name: "Screwdriver source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [
          {
            kind: "item",
            id: "gregtech:screwdriver.lv@0",
            amount: 1,
            displayName: "Screwdriver (LV)",
          },
        ],
      },
      {
        id: "screwdriver-oredict-target-recipe",
        name: "Ore dictionary tool target",
        machineType: "Crafting",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [
          {
            kind: "item",
            id: "oredict:craftingToolScrewdriver",
            amount: 1,
            displayName: "Screwdriver",
            alternatives: [
              {
                kind: "item",
                id: "gregtech:screwdriver.lv@0",
                displayName: "Screwdriver (LV)",
              },
              {
                kind: "item",
                id: "gregtech:screwdriver.mv@0",
                displayName: "Screwdriver (MV)",
              },
            ],
          },
        ],
        outputs: [{ kind: "item", id: "tool-crafted", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("item-source", "item-source-recipe", 0),
      makeNode("item-target", "item-target-recipe", 200),
      makeNode("fluid-source", "fluid-source-recipe", 0, 140),
      makeNode("fluid-target", "fluid-target-recipe", 200, 140),
      makeNode("nc-target", "nc-target-recipe", 200, 280),
      makeNode("stick-source", "stick-source-recipe", 0, 420),
      makeNode("stick-oredict-target", "stick-oredict-target-recipe", 200, 420),
      makeNode("screwdriver-source", "screwdriver-source-recipe", 0, 560),
      makeNode("screwdriver-oredict-target", "screwdriver-oredict-target-recipe", 200, 560),
    ],
    storages: [
      {
        id: "dust-drawer",
        kind: "item",
        resourceId: "dust",
        displayName: "Dust",
        position: { x: 100, y: 0 },
      },
      {
        id: "mold-drawer",
        kind: "item",
        resourceId: "mold",
        displayName: "Mold",
        position: { x: 100, y: 280 },
      },
      {
        id: "water-tank",
        kind: "fluid",
        resourceId: "water",
        displayName: "Water",
        position: { x: 100, y: 140 },
      },
      {
        id: "stick-drawer",
        kind: "item",
        resourceId: "minecraft:stick@0",
        displayName: "Stick",
        position: { x: 100, y: 420 },
      },
    ],
    edges: [],
    fuelProfiles: [],
  };
}

function createRatioOptimizationProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "ratio-optimization",
    name: "Ratio optimization",
    recipes: [
      {
        id: "dust-source-recipe",
        name: "Dust source",
        machineType: "Macerator",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "dust", amount: 1 }],
      },
      {
        id: "plate-target-recipe",
        name: "Plate target",
        machineType: "Assembler",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "dust", amount: 1 }],
        outputs: [{ kind: "item", id: "plate", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("dust-source", "dust-source-recipe", 0),
      {
        ...makeNode("plate-target", "plate-target-recipe", 240),
        targetOutput: {
          kind: "item",
          resourceId: "plate",
          amountPerSecond: 10,
        },
      },
    ],
    storages: [],
    edges: [
      {
        id: "dust-edge",
        source: "dust-source",
        target: "plate-target",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
        resourceKind: "item",
        resourceId: "dust",
      },
    ],
    fuelProfiles: [],
  };
}

function createCyclicRatioProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "cycle-ratio",
    name: "Cycle ratio",
    recipes: [
      {
        id: "cycle-a-recipe",
        name: "Cycle A",
        machineType: "A",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "y", amount: 2 }],
        outputs: [{ kind: "item", id: "x", amount: 1 }],
      },
      {
        id: "cycle-b-recipe",
        name: "Cycle B",
        machineType: "B",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "x", amount: 2 }],
        outputs: [{ kind: "item", id: "y", amount: 1 }],
      },
    ],
    nodes: [
      {
        ...makeNode("cycle-a", "cycle-a-recipe", 0),
        targetOutput: {
          kind: "item",
          resourceId: "x",
          amountPerSecond: 2,
        },
      },
      makeNode("cycle-b", "cycle-b-recipe", 240),
    ],
    storages: [],
    edges: [
      {
        id: "x-edge",
        source: "cycle-a",
        target: "cycle-b",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "x" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "x" }, 0),
        resourceKind: "item",
        resourceId: "x",
      },
      {
        id: "y-edge",
        source: "cycle-b",
        target: "cycle-a",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "y" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "y" }, 0),
        resourceKind: "item",
        resourceId: "y",
      },
    ],
    fuelProfiles: [],
  };
}

function createStableDirectCycleOptimizationProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "stable-direct-cycle-optimization",
    name: "Stable direct cycle optimization",
    recipes: [
      {
        id: "ingot-to-nuggets-recipe",
        name: "Ingot to Nuggets",
        machineType: "Alloy Smelter",
        minimumTier: "ULV",
        durationTicks: 100,
        eut: 1,
        inputs: [{ kind: "item", id: "ingot", amount: 1 }],
        outputs: [{ kind: "item", id: "nugget", amount: 9 }],
      },
      {
        id: "nuggets-to-ingot-recipe",
        name: "Nuggets to Ingot",
        machineType: "Alloy Smelter",
        minimumTier: "ULV",
        durationTicks: 200,
        eut: 1,
        inputs: [{ kind: "item", id: "nugget", amount: 9 }],
        outputs: [{ kind: "item", id: "ingot", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("cycle-ingot-to-nuggets", "ingot-to-nuggets-recipe", 0),
      makeNode("cycle-nuggets-to-ingot", "nuggets-to-ingot-recipe", 240),
    ],
    storages: [],
    edges: [
      {
        id: "cycle-nugget-edge",
        source: "cycle-ingot-to-nuggets",
        target: "cycle-nuggets-to-ingot",
        resourceKind: "item",
        resourceId: "nugget",
      },
      {
        id: "cycle-ingot-edge",
        source: "cycle-nuggets-to-ingot",
        target: "cycle-ingot-to-nuggets",
        resourceKind: "item",
        resourceId: "ingot",
      },
    ],
    fuelProfiles: [],
  };
}

function createStorageBusCycleProject(): FactoryProject {
  return {
    ...createCyclicRatioProject(),
    id: "storage-bus-cycle-ratio",
    nodes: [
      {
        ...makeNode("bus-cycle-a", "cycle-a-recipe", 0),
        targetOutput: {
          kind: "item",
          resourceId: "x",
          amountPerSecond: 2,
        },
      },
      makeNode("bus-cycle-b", "cycle-b-recipe", 240),
    ],
    storages: [
      { id: "x-out", kind: "item", resourceId: "x", position: { x: 120, y: 0 } },
      { id: "x-in", kind: "item", resourceId: "x", position: { x: 160, y: 0 } },
      { id: "y-out", kind: "item", resourceId: "y", position: { x: 120, y: 140 } },
      { id: "y-in", kind: "item", resourceId: "y", position: { x: 160, y: 140 } },
    ],
    edges: [
      {
        id: "x-out-edge",
        source: "bus-cycle-a",
        target: "x-out",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "x" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "x" }),
        resourceKind: "item",
        resourceId: "x",
      },
      {
        id: "x-in-edge",
        source: "x-in",
        target: "bus-cycle-b",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "x" }),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "x" }, 0),
        resourceKind: "item",
        resourceId: "x",
      },
      {
        id: "y-out-edge",
        source: "bus-cycle-b",
        target: "y-out",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "y" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "y" }),
        resourceKind: "item",
        resourceId: "y",
      },
      {
        id: "y-in-edge",
        source: "y-in",
        target: "bus-cycle-a",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "y" }),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "y" }, 0),
        resourceKind: "item",
        resourceId: "y",
      },
    ],
  };
}

function createSmallCyclicBottleneckProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "small-cycle-bottleneck",
    name: "Small cycle bottleneck",
    recipes: [
      {
        id: "small-cycle-source-recipe",
        name: "Small Cycle Source",
        machineType: "A",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "seed", amount: 1 }],
        outputs: [{ kind: "item", id: "product", amount: 1 }],
      },
      {
        id: "small-cycle-return-recipe",
        name: "Small Cycle Return",
        machineType: "B",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "product", amount: 1 }],
        outputs: [{ kind: "item", id: "seed", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("small-cycle-source", "small-cycle-source-recipe", 0),
      {
        ...makeNode("small-cycle-return", "small-cycle-return-recipe", 240),
        targetOutput: {
          kind: "item",
          resourceId: "seed",
          amountPerSecond: 50.2,
        },
      },
    ],
    storages: [],
    edges: [
      {
        id: "small-cycle-product-edge",
        source: "small-cycle-source",
        target: "small-cycle-return",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "product" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "product" }, 0),
        resourceKind: "item",
        resourceId: "product",
      },
      {
        id: "small-cycle-seed-edge",
        source: "small-cycle-return",
        target: "small-cycle-source",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "seed" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "seed" }, 0),
        resourceKind: "item",
        resourceId: "seed",
      },
    ],
    fuelProfiles: [],
  };
}

function createCatalystLoopOptimizationProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "catalyst-loop-optimization",
    name: "Catalyst loop optimization",
    recipes: [
      {
        id: "loop-compressor-recipe",
        name: "Loop Compressor",
        machineType: "Compressor",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "empty_cell", amount: 1 }],
        outputs: [{ kind: "item", id: "compressed_air_cell", amount: 1 }],
      },
      {
        id: "loop-centrifuge-recipe",
        name: "Loop Centrifuge",
        machineType: "Centrifuge",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "compressed_air_cell", amount: 5 }],
        outputs: [
          { kind: "fluid", id: "nitrogen", amount: 1_000 },
          { kind: "item", id: "empty_cell", amount: 4 },
          { kind: "item", id: "oxygen_cell", amount: 1 },
        ],
      },
      {
        id: "loop-canner-recipe",
        name: "Loop Canner",
        machineType: "Fluid Canner",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "oxygen_cell", amount: 1 }],
        outputs: [
          { kind: "item", id: "empty_cell", amount: 1 },
          { kind: "fluid", id: "oxygen", amount: 1_000 },
        ],
      },
      {
        id: "loop-terminal-recipe",
        name: "Loop Terminal",
        machineType: "Consumer",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "nitrogen", amount: 1_000 }],
        outputs: [{ kind: "fluid", id: "product", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("loop-compressor", "loop-compressor-recipe", 0),
      makeNode("loop-centrifuge", "loop-centrifuge-recipe", 240),
      makeNode("loop-canner", "loop-canner-recipe", 480),
      makeNode("loop-terminal", "loop-terminal-recipe", 720),
    ],
    storages: [
      {
        id: "loop-empty-cell-buffer",
        kind: "item",
        resourceId: "empty_cell",
        position: { x: 160, y: 120 },
      },
    ],
    edges: [
      {
        id: "loop-compressor-to-centrifuge",
        source: "loop-compressor",
        target: "loop-centrifuge",
        resourceKind: "item",
        resourceId: "compressed_air_cell",
      },
      {
        id: "loop-centrifuge-to-terminal",
        source: "loop-centrifuge",
        target: "loop-terminal",
        resourceKind: "fluid",
        resourceId: "nitrogen",
      },
      {
        id: "loop-centrifuge-to-canner",
        source: "loop-centrifuge",
        target: "loop-canner",
        resourceKind: "item",
        resourceId: "oxygen_cell",
      },
      {
        id: "loop-centrifuge-to-buffer",
        source: "loop-centrifuge",
        target: "loop-empty-cell-buffer",
        resourceKind: "item",
        resourceId: "empty_cell",
      },
      {
        id: "loop-canner-to-buffer",
        source: "loop-canner",
        target: "loop-empty-cell-buffer",
        resourceKind: "item",
        resourceId: "empty_cell",
      },
      {
        id: "loop-buffer-to-compressor",
        source: "loop-empty-cell-buffer",
        target: "loop-compressor",
        resourceKind: "item",
        resourceId: "empty_cell",
      },
    ],
    fuelProfiles: [],
  };
}

function createAmplifyingCycleProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "amplifying-cycle",
    name: "Amplifying cycle",
    recipes: [
      {
        id: "amplifying-a-recipe",
        name: "Amplifying A",
        machineType: "A",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "b", amount: 2 }],
        outputs: [{ kind: "item", id: "a", amount: 1 }],
      },
      {
        id: "amplifying-b-recipe",
        name: "Amplifying B",
        machineType: "B",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "a", amount: 2 }],
        outputs: [{ kind: "item", id: "b", amount: 1 }],
      },
    ],
    nodes: [
      {
        ...makeNode("amplifying-a", "amplifying-a-recipe", 0),
        targetOutput: {
          kind: "item",
          resourceId: "a",
          amountPerSecond: 10,
        },
      },
      makeNode("amplifying-b", "amplifying-b-recipe", 240),
    ],
    storages: [],
    edges: [
      {
        id: "amplifying-a-to-b",
        source: "amplifying-a",
        target: "amplifying-b",
        resourceKind: "item",
        resourceId: "a",
      },
      {
        id: "amplifying-b-to-a",
        source: "amplifying-b",
        target: "amplifying-a",
        resourceKind: "item",
        resourceId: "b",
      },
    ],
    fuelProfiles: [],
  };
}

function createAcyclicStorageBusProject(): FactoryProject {
  return {
    ...createRatioOptimizationProject(),
    id: "acyclic-storage-bus-ratio",
    nodes: [
      makeNode("bus-source", "dust-source-recipe", 0),
      {
        ...makeNode("bus-target", "plate-target-recipe", 240),
        targetOutput: {
          kind: "item",
          resourceId: "plate",
          amountPerSecond: 10,
        },
      },
    ],
    storages: [
      { id: "dust-out", kind: "item", resourceId: "dust", position: { x: 100, y: 0 } },
      { id: "dust-in", kind: "item", resourceId: "dust", position: { x: 140, y: 0 } },
    ],
    edges: [
      {
        id: "dust-out-edge",
        source: "bus-source",
        target: "dust-out",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }),
        resourceKind: "item",
        resourceId: "dust",
      },
      {
        id: "dust-in-edge",
        source: "dust-in",
        target: "bus-target",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
        resourceKind: "item",
        resourceId: "dust",
      },
    ],
  };
}

function createRecipeChainWithStorageSinkProject(): FactoryProject {
  return {
    ...createRatioOptimizationProject(),
    id: "recipe-chain-with-storage-sink",
    nodes: [
      makeNode("sink-source", "dust-source-recipe", 0),
      {
        ...makeNode("sink-target", "plate-target-recipe", 240),
        targetOutput: {
          kind: "item",
          resourceId: "plate",
          amountPerSecond: 10,
        },
      },
    ],
    storages: [{ id: "dust-sink", kind: "item", resourceId: "dust", position: { x: 120, y: 120 } }],
    edges: [
      {
        id: "sink-target-edge",
        source: "sink-source",
        target: "sink-target",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }, 0),
        resourceKind: "item",
        resourceId: "dust",
      },
      {
        id: "sink-storage-edge",
        source: "sink-source",
        target: "dust-sink",
        sourceHandle: makeResourceHandleId("output", { kind: "item", id: "dust" }, 0),
        targetHandle: makeResourceHandleId("input", { kind: "item", id: "dust" }),
        resourceKind: "item",
        resourceId: "dust",
      },
    ],
  };
}

function createSplitStorageInputOptimizationProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "split-storage-input-optimization",
    name: "Split storage input optimization",
    recipes: [
      {
        id: "storage-source-recipe",
        name: "Storage source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "dust", amount: 10 }],
      },
      {
        id: "direct-source-recipe",
        name: "Direct source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "dust", amount: 10 }],
      },
      {
        id: "consumer-recipe",
        name: "Consumer",
        machineType: "Assembler",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "dust", amount: 10 }],
        outputs: [{ kind: "item", id: "plate", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("storage-source", "storage-source-recipe", 0),
      makeNode("direct-source", "direct-source-recipe", 160),
      {
        ...makeNode("consumer", "consumer-recipe", 320),
        targetOutput: {
          kind: "item",
          resourceId: "plate",
          amountPerSecond: 1,
        },
      },
    ],
    storages: [
      { id: "dust-storage", kind: "item", resourceId: "dust", position: { x: 160, y: 120 } },
    ],
    edges: [
      {
        id: "storage-source-to-storage",
        source: "storage-source",
        target: "dust-storage",
        resourceKind: "item",
        resourceId: "dust",
      },
      {
        id: "storage-to-consumer",
        source: "dust-storage",
        target: "consumer",
        resourceKind: "item",
        resourceId: "dust",
      },
      {
        id: "direct-source-to-consumer",
        source: "direct-source",
        target: "consumer",
        resourceKind: "item",
        resourceId: "dust",
      },
    ],
    fuelProfiles: [],
  };
}

function createMultiOutputSplitInputOptimizationProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "multi-output-split-input-optimization",
    name: "Multi output split input optimization",
    recipes: [
      {
        id: "source-recipe",
        name: "Source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [
          { kind: "item", id: "dust", amount: 10 },
          { kind: "fluid", id: "oil", amount: 1000 },
        ],
      },
      {
        id: "item-consumer-recipe",
        name: "Item consumer",
        machineType: "Assembler",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "dust", amount: 10 }],
        outputs: [{ kind: "item", id: "plate", amount: 1 }],
      },
      {
        id: "fluid-consumer-recipe",
        name: "Fluid consumer",
        machineType: "Distillation Tower",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "oil", amount: 1000 }],
        outputs: [{ kind: "fluid", id: "light", amount: 1000 }],
      },
    ],
    nodes: [
      makeNode("source", "source-recipe", 0),
      {
        ...makeNode("item-consumer", "item-consumer-recipe", 220),
        targetOutput: {
          kind: "item",
          resourceId: "plate",
          amountPerSecond: 1,
        },
      },
      {
        ...makeNode("fluid-consumer", "fluid-consumer-recipe", 440),
        targetOutput: {
          kind: "fluid",
          resourceId: "light",
          amountPerSecond: 1000,
        },
      },
    ],
    storages: [{ id: "oil-tank", kind: "fluid", resourceId: "oil", position: { x: 260, y: 120 } }],
    edges: [
      {
        id: "source-to-item-consumer",
        source: "source",
        target: "item-consumer",
        resourceKind: "item",
        resourceId: "dust",
      },
      {
        id: "source-to-fluid-consumer",
        source: "source",
        target: "fluid-consumer",
        resourceKind: "fluid",
        resourceId: "oil",
      },
      {
        id: "source-to-oil-tank",
        source: "source",
        target: "oil-tank",
        resourceKind: "fluid",
        resourceId: "oil",
      },
      {
        id: "oil-tank-to-fluid-consumer",
        source: "oil-tank",
        target: "fluid-consumer",
        resourceKind: "fluid",
        resourceId: "oil",
      },
    ],
    fuelProfiles: [],
  };
}

function createSurplusStorageConsumerInputProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "surplus-storage-consumer-input-optimization",
    name: "Surplus storage consumer input optimization",
    recipes: [
      {
        id: "input-source-recipe",
        name: "Input source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "coal", amount: 1 }],
      },
      {
        id: "storage-producer-recipe",
        name: "Storage producer",
        machineType: "Fluid Extractor",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "coal", amount: 100 }],
        outputs: [{ kind: "fluid", id: "woodtar", amount: 10000 }],
      },
      {
        id: "direct-producer-recipe",
        name: "Direct producer",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "fluid", id: "woodtar", amount: 100 }],
      },
      {
        id: "storage-consumer-recipe",
        name: "Storage consumer",
        machineType: "Distillation Tower",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "woodtar", amount: 100 }],
        outputs: [{ kind: "fluid", id: "benzene", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("input-source", "input-source-recipe", 0),
      makeNode("storage-producer", "storage-producer-recipe", 220),
      makeNode("direct-producer", "direct-producer-recipe", 220, 140),
      makeNode("storage-consumer", "storage-consumer-recipe", 520),
    ],
    storages: [
      { id: "woodtar-tank", kind: "fluid", resourceId: "woodtar", position: { x: 380, y: 80 } },
    ],
    edges: [
      {
        id: "input-source-to-storage-producer",
        source: "input-source",
        target: "storage-producer",
        resourceKind: "item",
        resourceId: "coal",
      },
      {
        id: "storage-producer-to-tank",
        source: "storage-producer",
        target: "woodtar-tank",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
      {
        id: "direct-producer-to-tank",
        source: "direct-producer",
        target: "woodtar-tank",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
      {
        id: "tank-to-storage-consumer",
        source: "woodtar-tank",
        target: "storage-consumer",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
    ],
    fuelProfiles: [],
  };
}

function createImplicitTerminalStorageDemandProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "implicit-terminal-storage-demand",
    name: "Implicit terminal storage demand",
    recipes: [
      {
        id: "implicit-source-recipe",
        name: "Implicit Source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "fluid", id: "oil", amount: 10 }],
      },
      {
        id: "implicit-consumer-recipe",
        name: "Implicit Consumer",
        machineType: "Distillation Tower",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "oil", amount: 1 }],
        outputs: [{ kind: "fluid", id: "fuel", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("implicit-source", "implicit-source-recipe", 0),
      makeNode("implicit-consumer", "implicit-consumer-recipe", 320),
    ],
    storages: [
      { id: "implicit-oil-tank", kind: "fluid", resourceId: "oil", position: { x: 160, y: 0 } },
    ],
    edges: [
      {
        id: "implicit-source-to-tank",
        source: "implicit-source",
        target: "implicit-oil-tank",
        resourceKind: "fluid",
        resourceId: "oil",
      },
      {
        id: "implicit-tank-to-consumer",
        source: "implicit-oil-tank",
        target: "implicit-consumer",
        resourceKind: "fluid",
        resourceId: "oil",
      },
    ],
    fuelProfiles: [],
  };
}

function createImplicitRoundedStorageProducerProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "implicit-rounded-storage-producer",
    name: "Implicit rounded storage producer",
    recipes: [
      {
        id: "storage-producer-recipe",
        name: "Storage Producer",
        machineType: "Chemical Reactor",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "feedstock", amount: 1 }],
        outputs: [{ kind: "fluid", id: "product", amount: 3 }],
      },
      {
        id: "storage-consumer-recipe",
        name: "Storage Consumer",
        machineType: "Assembler",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "product", amount: 1 }],
        outputs: [{ kind: "item", id: "part", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("storage-producer", "storage-producer-recipe", 0),
      makeNode("storage-consumer", "storage-consumer-recipe", 320),
    ],
    storages: [
      { id: "product-tank", kind: "fluid", resourceId: "product", position: { x: 160, y: 0 } },
    ],
    edges: [
      {
        id: "producer-to-tank",
        source: "storage-producer",
        target: "product-tank",
        resourceKind: "fluid",
        resourceId: "product",
      },
      {
        id: "tank-to-consumer",
        source: "product-tank",
        target: "storage-consumer",
        resourceKind: "fluid",
        resourceId: "product",
      },
    ],
    fuelProfiles: [],
  };
}

function createImplicitParallelTerminalStorageDemandProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "implicit-parallel-terminal-storage-demand",
    name: "Implicit parallel terminal storage demand",
    recipes: [
      {
        id: "parallel-source-recipe",
        name: "Parallel Source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "fluid", id: "oil", amount: 1 }],
      },
      {
        id: "parallel-consumer-recipe",
        name: "Parallel Consumer",
        machineType: "Mega Distillation Tower",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "oil", amount: 1 }],
        outputs: [{ kind: "fluid", id: "fuel", amount: 1 }],
        machineConfigControls: [
          {
            id: "machineParallel",
            label: "Parallel",
            minimumKey: "x1",
            tiers: [
              {
                key: "x1",
                label: "1x",
                parallelMultiplier: 1,
                resource: { kind: "item", id: "parallel_1", amount: 1 },
              },
              {
                key: "x256",
                label: "256x",
                parallelMultiplier: 256,
                resource: { kind: "item", id: "parallel_256", amount: 1 },
              },
            ],
          },
        ],
      },
    ],
    nodes: [
      makeNode("parallel-source", "parallel-source-recipe", 0),
      {
        ...makeNode("parallel-consumer", "parallel-consumer-recipe", 320),
        machineConfigTiers: { machineParallel: "x256" },
      },
    ],
    storages: [
      { id: "parallel-oil-tank", kind: "fluid", resourceId: "oil", position: { x: 160, y: 0 } },
    ],
    edges: [
      {
        id: "parallel-source-to-tank",
        source: "parallel-source",
        target: "parallel-oil-tank",
        resourceKind: "fluid",
        resourceId: "oil",
      },
      {
        id: "parallel-tank-to-consumer",
        source: "parallel-oil-tank",
        target: "parallel-consumer",
        resourceKind: "fluid",
        resourceId: "oil",
      },
    ],
    fuelProfiles: [],
  };
}

function createImplicitRoundedSourceProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "implicit-rounded-source",
    name: "Implicit rounded source",
    recipes: [
      {
        id: "rounded-source-recipe",
        name: "Rounded Source",
        machineType: "Source",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [{ kind: "item", id: "input", amount: 5 }],
      },
      {
        id: "rounded-producer-recipe",
        name: "Rounded Producer",
        machineType: "Producer",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "input", amount: 1 }],
        outputs: [
          { kind: "fluid", id: "product", amount: 1 },
          { kind: "item", id: "byproduct", amount: 1 },
        ],
      },
      {
        id: "rounded-indirect-recipe",
        name: "Rounded Indirect",
        machineType: "Indirect",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "byproduct", amount: 1 }],
        outputs: [{ kind: "fluid", id: "product", amount: 5 }],
      },
      {
        id: "rounded-terminal-recipe",
        name: "Rounded Terminal",
        machineType: "Terminal",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "product", amount: 100 }],
        outputs: [{ kind: "fluid", id: "done", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("rounded-source", "rounded-source-recipe", 0),
      makeNode("rounded-producer", "rounded-producer-recipe", 180),
      makeNode("rounded-indirect", "rounded-indirect-recipe", 360),
      makeNode("rounded-terminal", "rounded-terminal-recipe", 540),
    ],
    storages: [
      { id: "rounded-tank", kind: "fluid", resourceId: "product", position: { x: 360, y: 160 } },
    ],
    edges: [
      {
        id: "rounded-source-to-producer",
        source: "rounded-source",
        target: "rounded-producer",
        resourceKind: "item",
        resourceId: "input",
      },
      {
        id: "rounded-producer-to-indirect",
        source: "rounded-producer",
        target: "rounded-indirect",
        resourceKind: "item",
        resourceId: "byproduct",
      },
      {
        id: "rounded-producer-to-tank",
        source: "rounded-producer",
        target: "rounded-tank",
        resourceKind: "fluid",
        resourceId: "product",
      },
      {
        id: "rounded-indirect-to-tank",
        source: "rounded-indirect",
        target: "rounded-tank",
        resourceKind: "fluid",
        resourceId: "product",
      },
      {
        id: "rounded-tank-to-terminal",
        source: "rounded-tank",
        target: "rounded-terminal",
        resourceKind: "fluid",
        resourceId: "product",
      },
    ],
    fuelProfiles: [],
  };
}

function createImplicitDirectAndIndirectStorageOutputProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "implicit-direct-indirect-storage-output",
    name: "Implicit direct and indirect storage output",
    recipes: [
      {
        id: "implicit-coke-recipe",
        name: "Implicit Coke",
        machineType: "Coke Oven",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [
          { kind: "item", id: "charcoal", amount: 300 },
          { kind: "fluid", id: "woodtar", amount: 2000 },
        ],
      },
      {
        id: "implicit-extractor-recipe",
        name: "Implicit Extractor",
        machineType: "Fluid Extractor",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "charcoal", amount: 100 }],
        outputs: [{ kind: "fluid", id: "woodtar", amount: 1000 }],
      },
      {
        id: "implicit-distillation-recipe",
        name: "Implicit Distillation",
        machineType: "Distillation Tower",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "woodtar", amount: 700 }],
        outputs: [{ kind: "fluid", id: "benzene", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("implicit-coke", "implicit-coke-recipe", 0),
      makeNode("implicit-extractor", "implicit-extractor-recipe", 240),
      makeNode("implicit-distillation", "implicit-distillation-recipe", 520),
    ],
    storages: [
      {
        id: "implicit-woodtar-tank",
        kind: "fluid",
        resourceId: "woodtar",
        position: { x: 380, y: 120 },
      },
    ],
    edges: [
      {
        id: "implicit-coke-to-extractor",
        source: "implicit-coke",
        target: "implicit-extractor",
        resourceKind: "item",
        resourceId: "charcoal",
      },
      {
        id: "implicit-coke-to-tank",
        source: "implicit-coke",
        target: "implicit-woodtar-tank",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
      {
        id: "implicit-extractor-to-tank",
        source: "implicit-extractor",
        target: "implicit-woodtar-tank",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
      {
        id: "implicit-tank-to-distillation",
        source: "implicit-woodtar-tank",
        target: "implicit-distillation",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
    ],
    fuelProfiles: [],
  };
}

function createDirectAndIndirectStorageOutputProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "direct-indirect-storage-output-optimization",
    name: "Direct and indirect storage output optimization",
    recipes: [
      {
        id: "coke-oven-recipe",
        name: "Coke Oven",
        machineType: "Coke Oven",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [],
        outputs: [
          { kind: "item", id: "charcoal", amount: 6.25 },
          { kind: "fluid", id: "woodtar", amount: 468.75 },
        ],
      },
      {
        id: "fluid-extractor-recipe",
        name: "Fluid Extractor",
        machineType: "Fluid Extractor",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "item", id: "charcoal", amount: 100 }],
        outputs: [{ kind: "fluid", id: "woodtar", amount: 10_000 }],
      },
      {
        id: "distillation-tower-recipe",
        name: "Distillation Tower",
        machineType: "Distillation Tower",
        minimumTier: "LV",
        durationTicks: 20,
        eut: 1,
        inputs: [{ kind: "fluid", id: "woodtar", amount: 1_000 }],
        outputs: [{ kind: "fluid", id: "benzene", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("coke-oven", "coke-oven-recipe", 0),
      makeNode("fluid-extractor", "fluid-extractor-recipe", 240),
      {
        ...makeNode("distillation-tower", "distillation-tower-recipe", 520),
        targetOutput: {
          kind: "fluid",
          resourceId: "benzene",
          amountPerSecond: 1,
        },
      },
    ],
    storages: [
      { id: "woodtar-tank", kind: "fluid", resourceId: "woodtar", position: { x: 380, y: 120 } },
    ],
    edges: [
      {
        id: "coke-to-fluid-extractor",
        source: "coke-oven",
        target: "fluid-extractor",
        resourceKind: "item",
        resourceId: "charcoal",
      },
      {
        id: "coke-to-tank",
        source: "coke-oven",
        target: "woodtar-tank",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
      {
        id: "fluid-extractor-to-tank",
        source: "fluid-extractor",
        target: "woodtar-tank",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
      {
        id: "tank-to-distillation-tower",
        source: "woodtar-tank",
        target: "distillation-tower",
        resourceKind: "fluid",
        resourceId: "woodtar",
      },
    ],
    fuelProfiles: [],
  };
}

function makeNode(id: string, recipeId: string, x: number, y = 0) {
  return {
    id,
    recipeId,
    machineCount: 1,
    parallel: 1,
    overclockTier: "LV",
    enabled: true,
    position: { x, y },
  };
}

function createNakCoolantProject(): FactoryProject {
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: "nak-chain",
    name: "NaK chain",
    recipes: [
      {
        id: "fluid-heater-recipe",
        name: "Fluid Heater: Sodium",
        machineType: "Fluid Heater",
        minimumTier: "MV",
        durationTicks: 200,
        eut: 120,
        inputs: [{ kind: "item", id: "sodium_dust", amount: 1 }],
        outputs: [{ kind: "fluid", id: "liquid_sodium", amount: 1000 }],
      },
      {
        id: "distillery-recipe",
        name: "Distillery: Sodium Potassium",
        machineType: "Distillery",
        minimumTier: "LV",
        durationTicks: 400,
        eut: 30,
        inputs: [
          { kind: "item", id: "rock_salt", amount: 1 },
          { kind: "fluid", id: "liquid_sodium", amount: 1000 },
        ],
        outputs: [{ kind: "fluid", id: "sodium_potassium", amount: 1000 }],
      },
      {
        id: "fluid-canner-recipe",
        name: "Fluid Canner: 60k NaK Coolant Cell",
        machineType: "Fluid Canner",
        minimumTier: "LV",
        durationTicks: 200,
        eut: 30,
        inputs: [
          { kind: "item", id: "10k_cell", amount: 1 },
          { kind: "fluid", id: "sodium_potassium", amount: 1000 },
        ],
        outputs: [{ kind: "item", id: "60k_nak_coolant_cell", amount: 1 }],
      },
    ],
    nodes: [
      makeNode("fluid-heater", "fluid-heater-recipe", 0, 0),
      makeNode("distillery", "distillery-recipe", 300, 0),
      makeNode("fluid-canner", "fluid-canner-recipe", 600, 0),
    ],
    storages: [],
    edges: [],
    fuelProfiles: [],
  };
}
