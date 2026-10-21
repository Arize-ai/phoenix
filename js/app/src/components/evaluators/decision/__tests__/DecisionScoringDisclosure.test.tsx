import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DecisionScoringDisclosure } from "../DecisionScoringDisclosure";

describe("DecisionScoringDisclosure", () => {
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

  const render = (defaultExpanded?: boolean) =>
    act(() => {
      root.render(
        <DecisionScoringDisclosure
          id="scoring"
          title="Evaluator scoring"
          summary="2 questions overridden"
          defaultExpanded={defaultExpanded}
        >
          <div data-testid="body">editor</div>
        </DecisionScoringDisclosure>
      );
    });
  const trigger = () =>
    container.querySelector<HTMLButtonElement>("button[slot='trigger']")!;

  it("is collapsed by default and shows the summary", () => {
    render();
    expect(container.textContent).toContain("2 questions overridden");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("expands when toggled, or when asked to start expanded", () => {
    render();
    act(() => trigger().click());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    act(() => root.unmount());
    root = createRoot(container);
    render(true);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });
});
