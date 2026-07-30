import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceTreeProvider } from "../TraceTreeContext";
import {
  TraceTreeTimingToggleButton,
  TraceTreeToolbar,
} from "../TraceTreeToolbar";

describe("TraceTreeTimingToggleButton", () => {
  installTestMatchMedia();

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

  it("toggles the shared trace-tree timing preference", async () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider showMetricsInTraceTree={false}>
            <TraceTreeTimingToggleButton />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });

    const user = userEvent.setup();
    const showTimingButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show metrics in trace tree"]'
    );
    expect(showTimingButton).not.toBeNull();

    await act(async () => user.click(showTimingButton!));

    expect(
      container.querySelector('button[aria-label="Hide metrics in trace tree"]')
    ).not.toBeNull();
  });
});

describe("TraceTreeToolbar error search shortcut", () => {
  installTestMatchMedia();

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

  function renderToolbar(errorCount: number) {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider>
            <TraceTreeProvider errorCount={errorCount}>
              <TraceTreeToolbar />
            </TraceTreeProvider>
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  it("does not show the shortcut when the trace has no errors", () => {
    renderToolbar(0);

    expect(
      container.querySelector('button[aria-label="Show error spans"]')
    ).toBeNull();
  });

  it("searches for errors and lets the clear button restore the tree", async () => {
    renderToolbar(2);

    const user = userEvent.setup();
    const errorShortcut = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Show error spans"]'
    );
    const searchInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search trace tree"]'
    );
    expect(errorShortcut?.querySelector("path")?.getAttribute("d")).toMatch(
      /^M20 11Q20 14\.2177/
    );
    expect(getComputedStyle(errorShortcut!).color).toBe(
      "var(--global-text-color-700)"
    );
    expect(searchInput?.value).toBe("");

    await act(async () => user.click(errorShortcut!));

    expect(searchInput?.value).toBe("ERR");
    expect(
      container.querySelector('button[aria-label="Show error spans"]')
    ).toBeNull();
    const clearButton = container.querySelector<HTMLButtonElement>(
      "button.search-field__clear"
    );
    expect(clearButton?.dataset.empty).toBeUndefined();

    await act(async () => user.click(clearButton!));

    expect(searchInput?.value).toBe("");
    expect(
      container.querySelector('button[aria-label="Show error spans"]')
    ).not.toBeNull();
  });
});
