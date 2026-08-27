/**
 * The preview renders what `materializeEvaluatorContext` produces, so this
 * only checks that the rows reach the screen: the slot order and the path each
 * slot reads. What those rows hold is pinned where the materialization lives.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { BindingPreview } from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";

describe("the binding preview", () => {
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

  it("renders each slot beside the path it reads", async () => {
    await act(async () => {
      root.render(
        <EvaluatorInputVariablesContext.Provider
          value={["input", "output", "metadata"]}
        >
          <BindingPreview
            context={getSampleSpanEvaluationContext("").context}
            grain="span"
            inputMapping={{
              pathMapping: { input: "metadata.span.name" },
              literalMapping: {},
            }}
            isSampleContext={false}
          />
        </EvaluatorInputVariablesContext.Provider>
      );
    });

    const keywords = [...container.querySelectorAll(".binding-row__keyword")];
    expect(keywords.slice(0, 3).map((node) => node.textContent)).toEqual([
      "input",
      "output",
      "metadata",
    ]);
    // The set path leads its slot; the untouched slots fall back to their own
    // defaults rather than to anything this component writes down.
    expect(
      [...container.querySelectorAll(".binding-row__path")].map(
        (node) => node.textContent
      )
    ).toEqual([
      "← metadata.span.name",
      "← metadata.span.output_value",
      "← metadata",
    ]);
  });
});
