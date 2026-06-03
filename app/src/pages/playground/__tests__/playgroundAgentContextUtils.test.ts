import { describe, expect, it } from "vitest";

import type { PlaygroundInstance } from "@phoenix/store/playground";

import {
  arePlaygroundInstancesForAgentEqual,
  getPlaygroundInstanceForAgent,
} from "../playgroundAgentContextUtils";

type AgentInstanceInput = Pick<PlaygroundInstance, "id" | "model" | "experiment">;

function makeInstance(
  overrides: Partial<AgentInstanceInput> = {}
): AgentInstanceInput {
  return {
    id: 0,
    model: {
      provider: "OPENAI",
      modelName: "gpt-4o",
    } as PlaygroundInstance["model"],
    experiment: null,
    ...overrides,
  };
}

describe("getPlaygroundInstanceForAgent", () => {
  it("includes a non-ephemeral experiment id", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({ experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false } })
    );
    expect(result.experimentId).toBe("RXhwZXJpbWVudDox");
  });

  it("excludes an ephemeral experiment id", () => {
    const result = getPlaygroundInstanceForAgent(
      makeInstance({ experiment: { id: "RXhwZXJpbWVudDoy", isEphemeral: true } })
    );
    expect(result.experimentId).toBeUndefined();
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
        model: { provider: "OPENAI", modelName: null } as PlaygroundInstance["model"],
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
        makeInstance({ experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false } })
      ),
    ];
    expect(arePlaygroundInstancesForAgentEqual(before, after)).toBe(false);
  });

  it("returns true when the experiment id and model are unchanged", () => {
    const left = [
      getPlaygroundInstanceForAgent(
        makeInstance({ experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false } })
      ),
    ];
    const right = [
      getPlaygroundInstanceForAgent(
        makeInstance({ experiment: { id: "RXhwZXJpbWVudDox", isEphemeral: false } })
      ),
    ];
    expect(arePlaygroundInstancesForAgentEqual(left, right)).toBe(true);
  });
});
