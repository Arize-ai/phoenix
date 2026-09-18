/**
 * The preview renders what `materializeEvaluatorContext` produces, so this
 * only checks that the rows reach the screen: the slot order and the path each
 * slot reads. What those rows hold is pinned where the materialization lives.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  beforeEach(() => {
    // `ThemeProvider` reads the system theme on mount; jsdom has no matchMedia.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
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
      "metadata",
      "output",
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

  it("sorts missing variables into the rows and describes the error inline", async () => {
    await act(async () => {
      root.render(
        <EvaluatorInputVariablesContext.Provider value={["any_thing", "input"]}>
          <BindingPreview
            context={getSampleTraceEvaluationContext().context}
            grain="trace"
            inputMapping={{ pathMapping: {}, literalMapping: {} }}
            requiredVariables={["any_thing", "input"]}
            isSampleContext={false}
          />
        </EvaluatorInputVariablesContext.Provider>
      );
    });

    const keywords = [...container.querySelectorAll(".binding-row__keyword")];
    expect(keywords.map((node) => node.textContent)).toEqual([
      "any_thing",
      "input",
      "metadata",
      "output",
    ]);
    const errorRow = container.querySelector('[data-variant="error"]');
    expect(errorRow?.querySelector('[aria-label="error"]')).not.toBeNull();
    expect(errorRow?.textContent).not.toContain("missing");
    expect(
      errorRow?.querySelector(".binding-row__error-message")?.textContent
    ).toBe("any_thing does not exist on this trace");
    expect(container.textContent).not.toContain("would fail on this trace");
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
      "missing.key does not exist on this span",
      "tool_call does not exist on this span",
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
