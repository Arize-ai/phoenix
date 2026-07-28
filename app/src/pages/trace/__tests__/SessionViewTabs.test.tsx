import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { DetailsPanel } from "../DetailsPanel";
import { resetDetailsPanelSizingStoreForTesting } from "../detailsPanelSizing/store";
import { SessionViewTabs } from "../SessionViewTabs";

describe("SessionViewTabs", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.ResizeObserver = originalResizeObserver;
    resetDetailsPanelSizingStoreForTesting();
    vi.restoreAllMocks();
  });

  it("renders a resizable details panel in the mounted document", () => {
    expect(() => {
      act(() => {
        root.render(
          <ThemeContext.Provider
            value={{
              theme: "light",
              systemTheme: "light",
              themeMode: "light",
              setThemeMode: vi.fn(),
            }}
          >
            <SessionViewTabs
              sessionView="turns"
              onSessionViewChange={() => {}}
              traceCount={2}
            >
              <DetailsPanel
                navigation={<div>Turns</div>}
                preferredTreeWidth={320}
                onPreferredTreeWidthChange={() => {}}
                treeMaximumWidth={480}
              >
                <div>Turn details</div>
              </DetailsPanel>
            </SessionViewTabs>
          </ThemeContext.Provider>
        );
      });
    }).not.toThrow();

    const group = container.querySelector("[data-group]");
    expect(group?.ownerDocument.defaultView).toBe(window);
  });
});
