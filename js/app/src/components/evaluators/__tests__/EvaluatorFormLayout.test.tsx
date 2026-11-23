/**
 * An evaluator form's sections are tabs, so a field that fails validation
 * can sit in a tab that is not selected. The tab says so while the field is
 * invalid, wherever the invalid state came from.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import { EvaluatorFormLayout } from "@phoenix/components/evaluators/EvaluatorFormLayout";

installTestStorage();

describe("EvaluatorFormLayout", () => {
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

  const renderForm = () =>
    act(async () => {
      root.render(
        <EvaluatorFormLayout
          layoutId="test"
          sections={[
            {
              id: "prompt",
              title: "Prompt",
              content: <input aria-label="Prompt field" />,
            },
            {
              id: "annotation",
              title: "Annotation",
              content: <input aria-label="Choice" aria-invalid="true" />,
            },
          ]}
          tryIt={null}
        />
      );
    });

  const markedTabs = () =>
    Array.from(container.querySelectorAll('[role="tab"]'))
      .filter((tab) => tab.querySelector('[aria-label="Has errors"]'))
      .map((tab) => tab.textContent);

  it("marks the tab that holds an invalid field, even when it is not selected", async () => {
    await renderForm();
    expect(
      container.querySelector('[role="tab"][aria-selected="true"]')?.textContent
    ).toBe("Prompt");
    expect(markedTabs()).toEqual(["Annotation"]);
  });

  it("clears the mark once the field is valid again", async () => {
    await renderForm();
    const field = container.querySelector('[aria-label="Choice"]');
    await act(async () => {
      field?.setAttribute("aria-invalid", "false");
      // MutationObserver callbacks run as microtasks.
      await Promise.resolve();
    });
    expect(markedTabs()).toEqual([]);
  });
});
