import { describe, expect, it } from "vitest";

import type { PlaygroundInstance } from "@phoenix/store/playground";

import {
  areExperimentScaffoldsForAgentEqual,
  arePlaygroundInstancesForAgentEqual,
  buildPlaygroundAgentContext,
  getExperimentScaffoldForAgent,
  getPlaygroundInstanceForAgent,
} from "../playgroundAgentContextUtils";
import { getDefaultOpenAIConfig } from "../providerAdapters/openaiAdapter";

type AgentInstanceInput = Pick<
  PlaygroundInstance,
  "id" | "model" | "experiment"
>;

function makeInstance(
  overrides: Partial<AgentInstanceInput> = {}
): AgentInstanceInput {
  return {
    id: 0,
    model: {
      provider: "OPENAI",
      modelName: "gpt-4o",
      invocationParameters: getDefaultOpenAIConfig(),
    },
    experiment: null,
    ...overrides,
  };
}

describe("getPlaygroundInstanceForAgent", () => {
  it("includes a non-ephemeral experiment id", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({
        experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
      })
    );
    expect(result.experimentId).toBe("RXhwZXJpbWVudDox");
  });

  it("includes an ephemeral experiment id", () => {
    // Ephemeral experiments persist in the DB for ~24h, so they stay queryable
    // and should be surfaced to the agent like any other run.
    const result = getPlaygroundInstanceForAgent(
      makeInstance({
        experiment: { id: "RXhwZXJpbWVudDoy", isEphemeral: true },
      })
    );
    expect(result.experimentId).toBe("RXhwZXJpbWVudDoy");
  });

  it("omits the experiment id when no experiment is present", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({ experiment: null })
    );
    expect(result.experimentId).toBeUndefined();
  });

  it("includes the experiment id when the instance has no model selection", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({
        model: {
          provider: "OPENAI",
          modelName: null,
          invocationParameters: getDefaultOpenAIConfig(),
        },
        experiment: { id: "RXhwZXJpbWVudDoz", isEphemeral: false },
      })
    );
    expect(result.model).toBeUndefined();
    expect(result.experimentId).toBe("RXhwZXJpbWVudDoz");
  });
});

describe("arePlaygroundInstancesForAgentEqual", () => {
  it("returns false when only the experiment id changes", () => {
    const before = [
      getPlaygroundInstanceForAgent(makeInstance({ experiment: null })),
    ];
    const after = [
      getPlaygroundInstanceForAgent(
        makeInstance({
          experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
        })
      ),
    ];
    expect(arePlaygroundInstancesForAgentEqual(before, after)).toBe(false);
  });

  it("returns true when the experiment id and model are unchanged", () => {
    const left = [
      getPlaygroundInstanceForAgent(
        makeInstance({
          experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
        })
      ),
    ];
    const right = [
      getPlaygroundInstanceForAgent(
        makeInstance({
          experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false },
        })
      ),
    ];
    expect(arePlaygroundInstancesForAgentEqual(left, right)).toBe(true);
  });
});

describe("getExperimentScaffoldForAgent", () => {
  it("returns null when no scaffold is staged", () => {
    expect(getExperimentScaffoldForAgent(null)).toBeNull();
  });

  it("advertises staged name/description and metadata presence, not the metadata itself", () => {
    expect(
      getExperimentScaffoldForAgent({
        name: "Shorter prompt",
        description: "Trimmed by half",
        metadata: { hypothesis: "fewer tokens" },
      })
    ).toEqual({
      name: "Shorter prompt",
      description: "Trimmed by half",
      hasMetadata: true,
    });
  });

  it("reports hasMetadata false for an absent or empty metadata object", () => {
    expect(getExperimentScaffoldForAgent({ name: "X" })).toEqual({
      name: "X",
      description: null,
      hasMetadata: false,
    });
    expect(getExperimentScaffoldForAgent({ metadata: {} })).toEqual({
      name: null,
      description: null,
      hasMetadata: false,
    });
  });
});

describe("areExperimentScaffoldsForAgentEqual", () => {
  it("returns false when the staged name changes", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        getExperimentScaffoldForAgent({ name: "A" }),
        getExperimentScaffoldForAgent({ name: "B" })
      )
    ).toBe(false);
  });

  it("returns false when metadata presence first appears", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        getExperimentScaffoldForAgent({ name: "A" }),
        getExperimentScaffoldForAgent({ name: "A", metadata: { k: "v" } })
      )
    ).toBe(false);
  });

  it("returns false when a scaffold is staged or cleared", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        null,
        getExperimentScaffoldForAgent({ name: "A" })
      )
    ).toBe(false);
  });

  it("returns true for equivalent advertised scaffolds", () => {
    expect(
      areExperimentScaffoldsForAgentEqual(
        getExperimentScaffoldForAgent({ name: "A", metadata: { k: "v" } }),
        getExperimentScaffoldForAgent({ name: "A", metadata: { k: "other" } })
      )
    ).toBe(true);
    expect(areExperimentScaffoldsForAgentEqual(null, null)).toBe(true);
  });
});

describe("buildPlaygroundAgentContext", () => {
  it("includes the current experiment recording mode and playground repetitions", () => {
    const instance = getPlaygroundInstanceForAgent(makeInstance());

    expect(
      buildPlaygroundAgentContext({
        recordExperiments: false,
        repetitions: 4,
        nextExperimentScaffold: null,
        instances: [instance],
      })
    ).toEqual({
      type: "playground",
      recordExperiments: false,
      repetitions: 4,
      nextExperimentScaffold: undefined,
      instances: [instance],
    });
  });

  it("surfaces the staged scaffold", () => {
    const instance = getPlaygroundInstanceForAgent(makeInstance());
    const scaffold = getExperimentScaffoldForAgent({ name: "Run with notes" });

    expect(
      buildPlaygroundAgentContext({
        recordExperiments: true,
        repetitions: 1,
        nextExperimentScaffold: scaffold,
        instances: [instance],
      })
    ).toEqual({
      type: "playground",
      recordExperiments: true,
      repetitions: 1,
      nextExperimentScaffold: scaffold,
      instances: [instance],
    });
  });
});
