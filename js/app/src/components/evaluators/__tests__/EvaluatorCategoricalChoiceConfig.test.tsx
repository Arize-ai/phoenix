import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  EvaluatorStoreProvider,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext";
import {
  DEFAULT_LLM_EVALUATOR_STORE_VALUES,
  type EvaluatorStoreInstance,
} from "@phoenix/store/evaluatorStore";

import { EvaluatorCategoricalChoiceConfig } from "../EvaluatorCategoricalChoiceConfig";

let capturedStore: EvaluatorStoreInstance | null = null;

function CaptureStore() {
  // eslint-disable-next-line react/globals
  capturedStore = useEvaluatorStoreInstance();
  return null;
}

/**
 * Regression for #15398: an outside write to the labels (PXI's
 * set_output_configs) was undone by the next validation, because the form
 * pushed back the labels it mounted with.
 */
describe("EvaluatorCategoricalChoiceConfig", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <EvaluatorStoreProvider
          initialState={DEFAULT_LLM_EVALUATOR_STORE_VALUES}
        >
          <CaptureStore />
          <EvaluatorCategoricalChoiceConfig />
        </EvaluatorStoreProvider>
      );
    });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    capturedStore = null;
  });

  it("keeps labels written to the store from outside through a submit validation", async () => {
    const store = capturedStore!;
    const [config] = store.getState().outputConfigs;
    act(() => {
      store.getState().setOutputConfigs([
        {
          ...config,
          optimizationDirection: "MAXIMIZE",
          values: [
            { label: "helpful", score: 1 },
            { label: "unhelpful", score: 0 },
          ],
        },
      ]);
    });
    await act(async () => {
      await store.getState().validateAll();
    });
    const [saved] = store.getState().outputConfigs;
    expect("values" in saved && saved.values).toEqual([
      { label: "helpful", score: 1 },
      { label: "unhelpful", score: 0 },
    ]);
    const inputValues = Array.from(
      container.querySelectorAll<HTMLInputElement>("input")
    ).map(({ value }) => value);
    expect(inputValues).toEqual(
      expect.arrayContaining(["helpful", "unhelpful"])
    );
  });
});
