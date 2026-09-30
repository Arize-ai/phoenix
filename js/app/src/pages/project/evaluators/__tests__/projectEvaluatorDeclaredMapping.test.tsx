/**
 * The server resolves every path in a mapping, declared or not, and a path
 * that matches nothing fails the run. So the project form keeps only the
 * variables the evaluator declares in the store, without losing what was
 * typed for one that is removed and then comes back.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

vi.mock("@phoenix/components/evaluators/EvaluatorPathField", () => ({
  EvaluatorPathField: ({ ariaLabel }: { ariaLabel: string }) => (
    <input aria-label={ariaLabel} readOnly />
  ),
}));

function DeclaredMappingForm({
  declaredVariables,
}: {
  declaredVariables: string[];
}) {
  useEvaluatorInputMappingControlsForm({
    pruneEmptyEntries: true,
    declaredVariables,
  });
  return null;
}

const STORED_PATHS = {
  context: "metadata.attributes.retrieval",
  input: "metadata.attributes.input",
};

describe("a project evaluator's mapping as its variables change", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: EvaluatorStoreInstance | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    store = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (declaredVariables: string[]) =>
    act(async () => {
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "LLM",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: { pathMapping: STORED_PATHS, literalMapping: {} },
            },
          }}
        >
          {({ store: storeInstance }) => {
            store = storeInstance;
            return (
              <DeclaredMappingForm declaredVariables={declaredVariables} />
            );
          }}
        </EvaluatorStoreProvider>
      );
    });

  it("leaves the stored mapping alone on open", async () => {
    // An evaluator opened and closed untouched must not read as edited.
    await render(["input"]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual(
      STORED_PATHS
    );
  });

  it("drops a removed variable's path and restores it when it returns", async () => {
    await render(["context", "input"]);
    await render(["input"]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual({
      input: STORED_PATHS.input,
    });
    await render(["context", "input"]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual(
      STORED_PATHS
    );
  });

  it("shows only declared variables as path-only mapping rows", async () => {
    await act(async () => {
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "LLM",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: { pathMapping: {}, literalMapping: {} },
            },
          }}
        >
          <EvaluatorInputVariablesContext.Provider
            value={["question", "rubric"]}
          >
            <ProjectEvaluatorInputMapping recordKind="span" />
          </EvaluatorInputVariablesContext.Provider>
        </EvaluatorStoreProvider>
      );
    });

    expect(
      [...container.querySelectorAll('input[aria-label$="path mapping"]')].map(
        (input) => input.getAttribute("aria-label")
      )
    ).toEqual(["question path mapping", "rubric path mapping"]);
    expect(container.querySelector("select")).toBeNull();
  });
});
