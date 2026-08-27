/**
 * A project evaluator's input mapping is authored as paths only, so its form
 * never registers a control over `literalMapping`. An evaluator that stored a
 * literal before that form existed still has to get it back unchanged after an
 * unrelated edit, or opening the evaluator would quietly drop what it binds.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Controller } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { dropOtherGrainEntityPathMappings } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

/**
 * The path-only form, registering the one control the project surface does:
 * a path field over a slot, with its `onChange` handed back to the test.
 */
function PathOnlyMappingForm({
  onReady,
}: {
  onReady: (onChange: (value: string) => void) => void;
}) {
  const { control } = useEvaluatorInputMappingControlsForm({
    pruneEmptyEntries: true,
    filterInitialMapping: (inputMapping) =>
      dropOtherGrainEntityPathMappings(inputMapping, "span"),
  });
  return (
    <Controller
      name="pathMapping.input"
      control={control}
      render={({ field }) => {
        onReady(field.onChange);
        return <input value={String(field.value ?? "")} readOnly />;
      }}
    />
  );
}

describe("a project evaluator's stored literal mapping", () => {
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

  it("survives an unrelated edit through the path-only form", async () => {
    let setPath: ((value: string) => void) | null = null;
    let store: EvaluatorStoreInstance | null = null;

    await act(async () => {
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
              inputMapping: {
                pathMapping: { input: "metadata.span.input_value" },
                literalMapping: { output: "pinned", metadata: 7 },
              },
            },
          }}
        >
          {({ store: storeInstance }) => {
            store = storeInstance;
            return (
              <PathOnlyMappingForm
                onReady={(onChange) => {
                  setPath = onChange;
                }}
              />
            );
          }}
        </EvaluatorStoreProvider>
      );
    });

    expect(setPath).not.toBeNull();
    expect(store).not.toBeNull();

    await act(async () => {
      setPath?.("metadata.span.output_value");
    });

    const { inputMapping } = store!.getState().evaluator;
    expect(inputMapping.pathMapping).toEqual({
      input: "metadata.span.output_value",
    });
    expect(inputMapping.literalMapping).toEqual({
      output: "pinned",
      metadata: 7,
    });
  });
});
