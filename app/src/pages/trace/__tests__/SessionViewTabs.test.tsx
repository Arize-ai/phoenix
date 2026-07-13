import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SessionViewTabs } from "../SessionViewTabs";

describe("SessionViewTabs", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // ThemeProvider resolves the system theme via matchMedia, which jsdom lacks
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("emits a view change when a different tab is clicked", () => {
    const onSessionViewChange = vi.fn();

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark">
          <SessionViewTabs
            sessionView="turns"
            onSessionViewChange={onSessionViewChange}
            traceCount={12}
          >
            <div>Session content</div>
          </SessionViewTabs>
        </ThemeProvider>
      );
    });

    const tracesTab = container.querySelectorAll('[role="tab"]')[1];
    expect(tracesTab).toBeInstanceOf(HTMLElement);

    act(() => {
      tracesTab?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
        })
      );
    });

    expect(onSessionViewChange).toHaveBeenCalledWith("traces");
  });

  it("emits a view change when the annotations tab is clicked", () => {
    const onSessionViewChange = vi.fn();

    act(() => {
      root.render(
        <ThemeProvider themeMode="dark">
          <SessionViewTabs
            sessionView="turns"
            onSessionViewChange={onSessionViewChange}
            traceCount={12}
          >
            <div>Session content</div>
          </SessionViewTabs>
        </ThemeProvider>
      );
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);

    act(() => {
      tabs[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSessionViewChange).toHaveBeenCalledWith("annotations");
  });
});
