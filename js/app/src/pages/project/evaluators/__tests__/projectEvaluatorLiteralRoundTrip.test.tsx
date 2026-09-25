/**
 * A project evaluator's input mapping is authored as paths only, so its form
 * never registers a control over `literalMapping`. An evaluator that stored a
 * literal before that form existed still has to get it back unchanged after an
 * unrelated edit, or opening the evaluator would quietly drop what it binds.
 * A path typed for the literal's own variable replaces it, because the server
 * would otherwise apply the literal over the path.
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
    pathsReplaceLiterals: true,
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

  const render = async (
    literalMapping: Record<string, string | number | boolean>
  ) => {
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
                pathMapping: { input: "metadata.attributes.input.value" },
                literalMapping,
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
    return {
      setPath: (value: string) =>
        act(async () => {
          setPath?.(value);
        }),
      inputMapping: () => store!.getState().evaluator.inputMapping,
    };
  };

  it("survives an unrelated edit through the path-only form", async () => {
    const form = await render({ output: "pinned", metadata: 7 });

    await form.setPath("metadata.attributes.output.value");

    expect(form.inputMapping().pathMapping).toEqual({
      input: "metadata.attributes.output.value",
    });
    expect(form.inputMapping().literalMapping).toEqual({
      output: "pinned",
      metadata: 7,
    });
  });

  it("gives way to a path typed for the same variable", async () => {
    const form = await render({ input: "stale", metadata: 7 });

    await form.setPath("metadata.attributes.output.value");
    expect(form.inputMapping().pathMapping).toEqual({
      input: "metadata.attributes.output.value",
    });
    expect(form.inputMapping().literalMapping).toEqual({ metadata: 7 });

    await form.setPath("");
    expect(form.inputMapping().pathMapping).toEqual({});
    expect(form.inputMapping().literalMapping).toEqual({
      input: "stale",
      metadata: 7,
    });
  });
});
