/**
 * The preview renders what `materializeEvaluatorContext` produces, so this
 * only checks that the rows reach the screen: the slot order and the path each
 * slot reads. What those rows hold is pinned where the materialization lives.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";
import {
  BindingPreview,
  RecordedRunRow,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorScopePanel";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";

describe("the binding preview", () => {
  let container: HTMLDivElement;
  let root: Root;

  // `ThemeProvider` reads the system theme on mount; jsdom has no matchMedia.
  installTestMatchMedia();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("lists the three defaults first, then the evaluator's other variables", async () => {
    await act(async () => {
      root.render(
        <EvaluatorInputVariablesContext.Provider value={["context", "input"]}>
          <BindingPreview
            context={getSampleSpanEvaluationContext().context}
            grain="span"
            inputMapping={{
              pathMapping: { context: "metadata.name" },
              literalMapping: {},
            }}
            isSampleContext={false}
          />
        </EvaluatorInputVariablesContext.Provider>
      );
    });

    const keywords = [...container.querySelectorAll(".binding-row__keyword")];
    expect(keywords.map((node) => node.textContent)).toEqual([
      "input",
      "output",
      "metadata",
      "context",
    ]);
  });

  it("renders each slot beside the path it reads", async () => {
    await act(async () => {
      root.render(
        <EvaluatorInputVariablesContext.Provider
          value={["input", "output", "metadata"]}
        >
          <BindingPreview
            context={getSampleSpanEvaluationContext().context}
            grain="span"
            inputMapping={{
              pathMapping: { input: "metadata.name" },
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
    // Only the set path is annotated: the untouched slots fall back to the
    // context key they are already labeled with, and `← output` under a row
    // labeled `output` is noise where the value belongs.
    expect(
      [...container.querySelectorAll(".binding-row__path")].map(
        (node) => node.textContent
      )
    ).toEqual(["← metadata.name"]);
  });

  it("replaces a slot that fails to bind in place and lists other missing variables where declared", async () => {
    await act(async () => {
      root.render(
        <EvaluatorInputVariablesContext.Provider
          value={["input", "metadata", "any_thing"]}
        >
          <BindingPreview
            context={getSampleTraceEvaluationContext().context}
            grain="trace"
            inputMapping={{
              pathMapping: { input: "missing.key", metadata: "nope" },
              literalMapping: {},
            }}
            requiredVariables={["input", "metadata", "any_thing"]}
            isSampleContext={false}
          />
        </EvaluatorInputVariablesContext.Provider>
      );
    });

    // Slot order holds and a missing slot appears once, as its error row; the
    // authored variable follows rather than sorting the whole list.
    const keywords = [...container.querySelectorAll(".binding-row__keyword")];
    expect(keywords.map((node) => node.textContent)).toEqual([
      "input",
      "output",
      "metadata",
      "any_thing",
    ]);
    const errorRows = [...container.querySelectorAll('[data-variant="error"]')];
    expect(
      errorRows.map(
        (row) => row.querySelector(".binding-row__message")?.textContent
      )
    ).toEqual([
      "missing.key does not exist on this trace, so evaluation fails",
      "nope does not exist on this trace, so evaluation fails",
      "any_thing does not exist on this trace, so evaluation fails",
    ]);
    expect(errorRows[0]?.querySelector('[aria-label="error"]')).not.toBeNull();
    // The metadata tree stays reachable from the errored slot, so the author
    // can browse for the path they meant.
    expect(
      errorRows[1]?.querySelector('button[aria-expanded="false"]')
    ).not.toBeNull();
    expect(errorRows[2]?.querySelector("button")).toBeNull();
  });

  it("replaces an unverified path with a warning in place, not a banner", async () => {
    await act(async () => {
      root.render(
        <EvaluatorInputVariablesContext.Provider
          value={["input", "output", "metadata", "citations"]}
        >
          <BindingPreview
            context={getSampleSpanEvaluationContext().context}
            grain="span"
            inputMapping={{
              pathMapping: {
                // A wildcard is the server's to resolve, so this side can only
                // defer — unlike `nope`, which is checked and wrong.
                input: "metadata.attributes.llm.input_messages[*].message",
                output: "nope",
                citations: "metadata.annotations[*]",
              },
              literalMapping: {},
            }}
            requiredVariables={["input", "output", "metadata", "citations"]}
            isSampleContext={false}
          />
        </EvaluatorInputVariablesContext.Provider>
      );
    });

    // Slot order holds: each deferred path replaces its own row rather than
    // stacking in a banner after the list.
    expect(
      [...container.querySelectorAll(".binding-row__keyword")].map(
        (node) => node.textContent
      )
    ).toEqual(["input", "output", "metadata", "citations"]);
    const warningRows = [
      ...container.querySelectorAll('[data-variant="warning"]'),
    ];
    expect(
      warningRows.map(
        (row) => row.querySelector(".binding-row__keyword")?.textContent
      )
    ).toEqual(["input", "citations"]);
    // A path that is checked and wrong stays an error beside them.
    expect(
      [...container.querySelectorAll('[data-variant="error"]')].map(
        (row) => row.querySelector(".binding-row__keyword")?.textContent
      )
    ).toEqual(["output"]);
    expect(
      warningRows.map(
        (row) => row.querySelector(".binding-row__message")?.textContent
      )
    ).toEqual([
      "metadata.attributes.llm.input_messages[*].message is checked when the evaluator runs",
      "metadata.annotations[*] is checked when the evaluator runs",
    ]);
    expect(
      warningRows[0]?.querySelector('[aria-label="warning"]')
    ).not.toBeNull();
    // Nothing is left to open onto, and no banner follows the rows.
    expect(warningRows[1]?.querySelector("button")).toBeNull();
    expect(container.querySelector(".alert__icon-title-wrap")).toBeNull();
  });

  it("counts mapping errors on the collapsed row and names each on hover", async () => {
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorInputVariablesContext.Provider
            value={["input", "tool_call"]}
          >
            <ul>
              <RecordedRunRow
                row={{
                  key: "span-id",
                  name: "errored span",
                  context: { input: "hello" },
                  isSample: false,
                }}
                recordNoun="span"
                isExpanded={false}
                onToggleExpanded={() => {}}
                run={undefined}
                isRunnable
                onRun={() => {}}
                inputMapping={{
                  pathMapping: { input: "missing.key" },
                  literalMapping: {},
                }}
                requiredVariables={["input", "tool_call"]}
              />
            </ul>
          </EvaluatorInputVariablesContext.Provider>
        </ThemeProvider>
      );
    });

    const counter = container.querySelector(".counter");
    expect(counter?.getAttribute("data-variant")).toBe("danger");
    expect(counter?.textContent).toBe("2");
    expect(
      container.querySelector(".card")?.getAttribute("data-collapsed")
    ).toBe("true");

    const trigger = counter?.closest('[role="button"]');
    expect(trigger).not.toBeNull();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => {
      // React Aria opens a tooltip on hover only while the interaction
      // modality is a pointer, which a real pointer event establishes.
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" })
      );
      trigger?.dispatchEvent(
        new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" })
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    vi.useRealTimers();

    // The tooltip portals out of the row, and each line it lists reads from the
    // same template the inline error rows use.
    const tooltip = document.querySelector('[role="tooltip"]');
    expect(
      [...(tooltip?.querySelectorAll("p, span") ?? [])]
        .map((node) => node.textContent)
        .filter((text) => text?.includes("does not exist"))
    ).toEqual([
      "missing.key does not exist on this span, so evaluation fails",
      "tool_call does not exist on this span, so evaluation fails",
    ]);
    // One error icon per line, and only the arrow's own svg besides those.
    expect(tooltip?.querySelectorAll("i.icon-wrap")).toHaveLength(2);
  });

  it("leaves the collapsed row's toggle reachable through the count", async () => {
    const onToggleExpanded = vi.fn();
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <EvaluatorInputVariablesContext.Provider value={["input"]}>
            <ul>
              <RecordedRunRow
                row={{
                  key: "span-id",
                  name: "errored span",
                  context: {},
                  isSample: false,
                }}
                recordNoun="span"
                isExpanded={false}
                onToggleExpanded={onToggleExpanded}
                run={undefined}
                isRunnable
                onRun={() => {}}
                inputMapping={{ pathMapping: {}, literalMapping: {} }}
                requiredVariables={["input"]}
              />
            </ul>
          </EvaluatorInputVariablesContext.Provider>
        </ThemeProvider>
      );
    });

    const trigger = container
      .querySelector(".counter")
      ?.closest('[role="button"]');
    expect(trigger).not.toBeNull();
    await act(async () => {
      trigger?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerId: 1,
          button: 0,
          pointerType: "mouse",
        })
      );
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerId: 1,
          button: 0,
          pointerType: "mouse",
        })
      );
      // The click that follows a press reaches the header, which must not
      // toggle the card a second time.
      trigger?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });
});
