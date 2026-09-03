import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useEvaluatorMappingSourceBoundToRow } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

const SESSION_ROW = {
  rowKey: "session-1",
  context: {
    input: "hi",
    output: "hello",
    metadata: { turns: [{ input: "hi", output: "hello" }] },
  },
};

function RunListRow({
  onStore,
}: {
  onStore: (store: EvaluatorStoreInstance) => void;
}) {
  onStore(useEvaluatorStoreInstance());
  useEvaluatorMappingSourceBoundToRow({ grain: "session", ...SESSION_ROW });
  return null;
}

describe("useEvaluatorMappingSourceBoundToRow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("binds the open row's context to the store under the row's own grain", async () => {
    let store: EvaluatorStoreInstance | null = null;
    await act(async () =>
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "CODE",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: { pathMapping: {}, literalMapping: {} },
            },
          }}
        >
          <RunListRow
            onStore={(instance) => {
              store = instance;
            }}
          />
        </EvaluatorStoreProvider>
      )
    );
    expect(store!.getState().evaluatorMappingSource).toEqual({
      grain: "session",
      source: SESSION_ROW.context,
    });
  });
});
