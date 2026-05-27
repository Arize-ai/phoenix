import { describe, expect, it } from "vitest";

import type { AgentState } from "@phoenix/store/agentStore";

import { selectActiveContexts } from "../selectors";

function stateWithContexts(
  routeContexts: AgentState["routeContexts"],
  mountedContexts: AgentState["mountedContexts"]
): AgentState {
  return {
    routeContexts,
    mountedContexts,
  } as AgentState;
}

describe("selectActiveContexts", () => {
  it("keeps the dataset evaluators surface context before the form is mounted", () => {
    const contexts = selectActiveContexts(
      stateWithContexts([], {
        dataset: {
          type: "dataset",
          datasetNodeId: "RGF0YXNldDox",
          datasetVersionNodeId: "RGF0YXNldFZlcnNpb246MQ==",
        },
        datasetEvaluators: {
          type: "dataset_evaluators",
          datasetNodeId: "RGF0YXNldDox",
          datasetVersionNodeId: null,
        },
      })
    );

    expect(contexts).toEqual([
      {
        type: "dataset",
        datasetNodeId: "RGF0YXNldDox",
        datasetVersionNodeId: "RGF0YXNldFZlcnNpb246MQ==",
      },
      {
        type: "dataset_evaluators",
        datasetNodeId: "RGF0YXNldDox",
        datasetVersionNodeId: null,
      },
    ]);
  });

  it("drops the dataset evaluators surface context while a code evaluator form is mounted", () => {
    const contexts = selectActiveContexts(
      stateWithContexts([], {
        dataset: {
          type: "dataset",
          datasetNodeId: "RGF0YXNldDox",
          datasetVersionNodeId: "RGF0YXNldFZlcnNpb246MQ==",
        },
        datasetEvaluators: {
          type: "dataset_evaluators",
          datasetNodeId: "RGF0YXNldDox",
          datasetVersionNodeId: null,
        },
        codeEvaluator: {
          type: "code_evaluator",
          evaluatorNodeId: null,
        },
      })
    );

    expect(contexts).toEqual([
      {
        type: "dataset",
        datasetNodeId: "RGF0YXNldDox",
        datasetVersionNodeId: "RGF0YXNldFZlcnNpb246MQ==",
      },
      {
        type: "code_evaluator",
        evaluatorNodeId: null,
      },
    ]);
  });
});
