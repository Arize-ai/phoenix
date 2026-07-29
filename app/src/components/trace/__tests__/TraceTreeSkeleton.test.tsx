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
    ).toHaveLength(6);

    renderSkeleton(false);
    expect(container.querySelector(".trace-tree-skeleton__full")).toBe(
      fullSkeleton
    );
    expect(fullSkeleton?.hasAttribute("aria-hidden")).toBe(false);
  });
});
