import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceTreeSkeleton } from "../TraceTreeSkeleton";

describe("TraceTreeSkeleton", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const renderSkeleton = (isNavigationCollapsed: boolean) => {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider>
            <TraceTreeSkeleton isNavigationCollapsed={isNavigationCollapsed} />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  };

  it("renders four rows at nesting levels zero, one, two, one", () => {
    renderSkeleton(false);

    const tree = container.querySelector<HTMLElement>(
      '[data-testid="trace-tree-skeleton"]'
    );
    const rows = tree?.querySelectorAll<HTMLElement>(".span-node-wrap");
    const connectors = tree?.querySelectorAll<HTMLElement>(
      ".span-tree-edge, .span-tree-edge-connector"
    );
    const nestingLevels = Array.from(rows ?? []).map((row) => {
      let ancestor = row.parentElement;
      let nestingLevel = 0;
      while (ancestor && ancestor !== tree) {
        if (ancestor.tagName === "LI") {
          nestingLevel += 1;
        }
        ancestor = ancestor.parentElement;
      }
      return nestingLevel;
    });

    expect(rows).toHaveLength(4);
    expect(nestingLevels).toEqual([0, 1, 2, 1]);
    expect(connectors).toHaveLength(4);
    const styleRules = Array.from(document.styleSheets).flatMap((styleSheet) =>
      Array.from(styleSheet.cssRules)
    );
    connectors?.forEach((connector) => {
      const generatedClassName = Array.from(connector.classList).find(
        (className) => className.startsWith("css-")
      );
      const connectorStyleRule = styleRules.find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === `.${generatedClassName}`
      );
      expect(connectorStyleRule?.style.borderLeft).toBe(
        "1px solid var(--global-skeleton-background-color)"
      );
      expect(connectorStyleRule?.style.opacity).toBe(
        "var(--global-skeleton-opacity)"
      );
    });
  });

  it("keeps one cold tree mounted while switching between full and compact loading states", () => {
    renderSkeleton(false);
    const fullSkeleton = container.querySelector(".trace-tree-skeleton__full");
    expect(fullSkeleton?.hasAttribute("aria-hidden")).toBe(false);
    expect(
      container.querySelector('[aria-label="Loading trace navigation"]')
    ).toBeNull();

    renderSkeleton(true);
    expect(container.querySelector(".trace-tree-skeleton__full")).toBe(
      fullSkeleton
    );
    expect(fullSkeleton?.getAttribute("aria-hidden")).toBe("true");
    expect(
      container.querySelectorAll('[aria-label="Loading trace navigation"] > li')
    ).toHaveLength(4);

    renderSkeleton(false);
    expect(container.querySelector(".trace-tree-skeleton__full")).toBe(
      fullSkeleton
    );
    expect(fullSkeleton?.hasAttribute("aria-hidden")).toBe(false);
  });
});
