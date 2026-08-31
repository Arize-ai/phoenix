/**
 * Switching the target back to a list whose rows are already cached remounts
 * that list with its context in hand, so the row binds the mapping source
 * before the target's grain effect has moved the store off the old grain. The
 * store turns the context away, resets to the new grain's blank default, and
 * the mapping diagnostics then read against nothing while a real context is
 * open on screen.
 */
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import { useEvaluatorMappingSourceBoundToRow } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

const SESSION_ROW = {
  rowKey: "session-1",
  context: {
    input: "hi",
    output: "hello",
    metadata: { turns: [{ input: "hi", output: "hello" }] },
  },
};

const SPAN_ROW = {
  rowKey: "span-1",
  context: {
    input: "What is Phoenix?",
    output: "An AI observability platform",
    metadata: { attributes: { llm: { model_name: "gpt-4o-mini" } } },
  },
};

/** The run list under the target: it binds whichever row is open. */
function RunListRow({ rowKey, context }: { rowKey: string; context: unknown }) {
  useEvaluatorMappingSourceBoundToRow({ rowKey, context });
  return null;
}

/**
 * The panel above it, which owns the target and tells the store what grain the
 * target is on — an effect that runs after the row's, as a parent's does.
 */
function ScopePanel({
  grain,
  row,
  onStore,
}: {
  grain: ProjectEvaluatorMappingSourceGrain;
  row: { rowKey: string; context: unknown };
  onStore: (store: EvaluatorStoreInstance) => void;
}) {
  const store = useEvaluatorStoreInstance();
  onStore(store);
  useEffect(() => {
    store.getState().setEvaluatorMappingSourceGrain(grain);
  }, [store, grain]);
  return <RunListRow rowKey={row.rowKey} context={row.context} />;
}

describe("toggling the target back to a cached list", () => {
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

  it("binds the open row's context rather than the new grain's blank default", async () => {
    let store: EvaluatorStoreInstance | null = null;
    const render = (
      grain: ProjectEvaluatorMappingSourceGrain,
      row: { rowKey: string; context: unknown }
    ) =>
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
            evaluatorMappingSource: {
              grain: "session",
              source: SESSION_ROW.context,
            },
          }}
        >
          <ScopePanel
            grain={grain}
            row={row}
            onStore={(instance) => {
              store = instance;
            }}
          />
        </EvaluatorStoreProvider>
      );

    await act(async () => render("session", SESSION_ROW));
    expect(store).not.toBeNull();

    // The span list comes back with its row already cached, so the row binds in
    // the same commit that moves the target's grain.
    await act(async () => render("span", SPAN_ROW));

    expect(store!.getState().evaluatorMappingSource).toEqual({
      grain: "span",
      source: SPAN_ROW.context,
    });
  });
});
