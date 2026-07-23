import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TimeRangeSelector } from "../TimeRangeSelector";
import type { OpenTimeRangeWithKey } from "../types";
import { getTimeRangeFromLastNTimeRangeKey } from "../utils";

describe("TimeRangeSelector", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth"
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:30.000Z"));
    // The presets popover only mounts once the trigger has a measurable width
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 400,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    if (originalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetWidth",
        originalOffsetWidth
      );
    }
    vi.useRealTimers();
  });

  async function renderSelector(onChange: (value: unknown) => void) {
    const timeRange: OpenTimeRangeWithKey = {
      timeRangeKey: "15m",
      ...getTimeRangeFromLastNTimeRangeKey("15m"),
    };
    await act(async () => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <TimeRangeSelector value={timeRange} onChange={onChange} />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  /** Focuses the trigger, which opens the presets popover with its search. */
  async function openPresets() {
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(".time-range-selector__value")
        ?.focus();
    });
    // The popover is portaled, so search the document
    const searchInput = document.querySelector<HTMLInputElement>(
      'input[type="search"]'
    );
    expect(searchInput).not.toBeNull();
    return searchInput as HTMLInputElement;
  }

  async function typeIntoSearch(searchInput: HTMLInputElement, text: string) {
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      setValue?.call(searchInput, text);
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  function getOptionLabels() {
    return Array.from(document.querySelectorAll('[role="option"]')).map(
      (option) => option.textContent
    );
  }

  it("commits a typed duration as an open last-N range", async () => {
    const onChange = vi.fn();
    await renderSelector(onChange);
    const searchInput = await openPresets();
    await typeIntoSearch(searchInput, "25m");

    expect(getOptionLabels()).toEqual(["Last 25 minutes"]);

    // Move virtual focus onto the (only) option, then commit it
    for (const key of ["ArrowDown", "Enter"]) {
      await act(async () => {
        searchInput.dispatchEvent(
          new KeyboardEvent("keydown", {
            key,
            code: key,
            bubbles: true,
            cancelable: true,
          })
        );
      });
    }

    expect(onChange).toHaveBeenCalledTimes(1);
    const committed = onChange.mock.calls[0][0];
    expect(committed.timeRangeKey).toBe("25m");
    expect(committed.start?.toISOString()).toBe("2026-06-09T09:35:00.000Z");
    expect(committed.end).toBeNull();
  });

  it("suggests every unit for a bare quantity, deduped against presets", async () => {
    await renderSelector(() => undefined);
    const searchInput = await openPresets();
    // "1" collides with the "1h" and "1d" preset keys, which keep their
    // curated labels, and also text-matches the "15m" and "12h" presets
    await typeIntoSearch(searchInput, "1");

    expect(getOptionLabels()).toEqual([
      "Last 1 minute",
      "Last Hour",
      "Last Day",
      "Last 15 Min",
      "Last 12 Hours",
    ]);
  });

  it("returns to the compact value when focus leaves the presets", async () => {
    await renderSelector(() => undefined);
    const searchInput = await openPresets();
    const externalButton = document.createElement("button");
    document.body.appendChild(externalButton);

    await act(async () => {
      externalButton.focus();
      vi.runAllTimers();
    });

    expect(searchInput.isConnected).toBe(false);
    expect(container.querySelector(".time-range-selector__fields")).toBeNull();
    expect(
      container.querySelector(".time-range-selector__value")
    ).not.toBeNull();
    externalButton.remove();
  });
});
