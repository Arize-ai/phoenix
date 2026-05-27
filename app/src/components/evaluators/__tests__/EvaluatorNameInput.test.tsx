import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

import { EvaluatorDescriptionInput } from "../EvaluatorDescriptionInput";
import { EvaluatorNameInput } from "../EvaluatorNameInput";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderEvaluatorInputs() {
  let storeRef: EvaluatorStoreInstance | null = null;
  act(() => {
    root.render(
      <EvaluatorStoreProvider
        initialState={{
          evaluator: {
            kind: "CODE",
            globalName: "",
            name: "",
            description: "",
            inputMapping: { literalMapping: {}, pathMapping: {} },
            isBuiltin: false,
            includeExplanation: false,
          },
          outputConfigs: [],
        }}
      >
        {({ store }) => {
          storeRef = store;
          return (
            <>
              <EvaluatorNameInput />
              <EvaluatorDescriptionInput />
            </>
          );
        }}
      </EvaluatorStoreProvider>
    );
  });
  if (storeRef == null) {
    throw new Error("Evaluator store was not captured");
  }
  return storeRef as EvaluatorStoreInstance;
}

function getInputByLabel(labelText: string): HTMLInputElement {
  const labels = Array.from(container.querySelectorAll("label"));
  const label = labels.find((candidate) =>
    candidate.textContent?.includes(labelText)
  );
  const input = label?.parentElement?.querySelector("input");
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`Could not find input for ${labelText}`);
  }
  return input;
}

describe("EvaluatorNameInput", () => {
  it("reflects programmatic evaluator draft updates in visible fields", () => {
    const store = renderEvaluatorInputs();

    act(() => {
      store.getState().setEvaluatorGlobalName("has_tool_call");
      store
        .getState()
        .setEvaluatorDescription("Checks whether the output has a tool call.");
    });

    expect(getInputByLabel("Name").value).toBe("has_tool_call");
    expect(getInputByLabel("Description").value).toBe(
      "Checks whether the output has a tool call."
    );
  });
});
