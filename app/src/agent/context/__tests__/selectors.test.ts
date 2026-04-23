import type { AgentState } from "@phoenix/store/agentStore";

import type { AgentContext } from "../agentContextTypes";
import { selectActiveContexts } from "../selectors";

function stateWith({
  routeContexts,
  mountedContexts,
}: {
  routeContexts: AgentContext[];
  mountedContexts: Record<string, AgentContext>;
}): AgentState {
  return { routeContexts, mountedContexts } as unknown as AgentState;
}

describe("selectActiveContexts", () => {
  it("returns an empty array when nothing is advertised", () => {
    expect(
      selectActiveContexts(
        stateWith({ routeContexts: [], mountedContexts: {} })
      )
    ).toEqual([]);
  });

  it("merges route-derived contexts before mount-advertised ones", () => {
    const state = stateWith({
      routeContexts: [{ type: "project", projectId: "P1" }],
      mountedContexts: {
        a: {
          type: "span_filter",
          projectId: "P1",
          condition: "status_code == 'ERROR'",
        },
      },
    });
    const result = selectActiveContexts(state);
    expect(result.map((c) => c.type)).toEqual(["project", "span_filter"]);
  });

  it("dedupes contexts with the same logical key", () => {
    const state = stateWith({
      routeContexts: [{ type: "project", projectId: "P1" }],
      mountedContexts: {
        a: { type: "project", projectId: "P1" },
      },
    });
    expect(selectActiveContexts(state)).toHaveLength(1);
  });
});
