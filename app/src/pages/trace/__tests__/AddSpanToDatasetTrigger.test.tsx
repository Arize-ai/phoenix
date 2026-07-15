import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { AddSpanToDatasetTrigger } from "../AddSpanToDatasetTrigger";

describe("AddSpanToDatasetTrigger", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    vi.useRealTimers();
  });

  function render(buttonText: string | null) {
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark">
          <AddSpanToDatasetTrigger buttonText={buttonText} />
        </ThemeProvider>
      );
    });
  }

  it("keeps a stable accessible name in the labeled state", () => {
    render("Add to Dataset");

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Add to Dataset");
    expect(button?.textContent).toBe("Add to Dataset");

    act(() => {
      button?.focus();
    });
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
  });

  it("shows a tooltip when the icon-only state is focused", () => {
    vi.useFakeTimers();
    render(null);

    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Add to Dataset");
    expect(button?.textContent).toBe("");

    act(() => {
      button?.focus();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toBe(
      "Add to Dataset"
    );
  });
});
