import type { AgentState } from "@phoenix/store/agentStore";

import type { AgentContext } from "../agentContextTypes";
import { selectActiveContexts } from "../selectors";

function stateWith(
  routeContexts: AgentContext[],
  mountedContexts: Record<string, AgentContext> = {}
): AgentState {
  return { routeContexts, mountedContexts } as AgentState;
}

describe("selectActiveContexts playground merge", () => {
  it("merges the evaluator roster onto the instances-bearing playground context", () => {
    const instances: AgentContext = {
      type: "playground",
      instances: [{ instanceId: 1 }],
    };
    const roster: AgentContext = {
      type: "playground",
      evaluators: [
        {
          datasetEvaluatorId: "a",
          name: "Exact Match",
          kind: "CODE",
          isBuiltin: false,
          isApplied: true,
        },
      ],
    };

    const active = selectActiveContexts(
      stateWith([instances], { mountId: roster })
    );

    const playground = active.find((ctx) => ctx.type === "playground");
    expect(playground).toBeDefined();
    if (playground?.type === "playground") {
      // Both contributors' fields survive the dedup into one playground entry.
      expect(playground.instances).toEqual([{ instanceId: 1 }]);
      expect(playground.evaluators).toHaveLength(1);
      expect(playground.evaluators?.[0]?.datasetEvaluatorId).toBe("a");
    }
    // Exactly one playground context is advertised.
    expect(active.filter((ctx) => ctx.type === "playground")).toHaveLength(1);
  });
});

it("keeps the page's task kind when the evaluator roster fragment merges in", () => {
  const page: AgentContext = {
    type: "playground",
    taskKind: "evaluator",
    recordExperiments: false,
    instances: [
      {
        instanceId: 4,
        task: { kind: "evaluator", evaluatorKind: "CODE", name: "judge" },
      },
    ],
  };

  const merged = selectActiveContexts(
    stateWith([page], {
      roster: { type: "playground", evaluators: [] },
    })
  );

  expect(merged).toHaveLength(1);
  expect(merged[0]).toMatchObject({
    taskKind: "evaluator",
    recordExperiments: false,
    instances: [{ instanceId: 4, task: { evaluatorKind: "CODE" } }],
  });
});
