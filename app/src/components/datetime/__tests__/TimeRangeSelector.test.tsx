import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TimeRangeSelector } from "../TimeRangeSelector";
import { getTimeRangeFromLastNTimeRangeKey } from "../utils";

describe("TimeRangeSelector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalMatchMedia: typeof window.matchMedia | undefined;
  let originalOffsetWidth: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "offsetWidth"
    );
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get() {
        return this.classList.contains("time-range-selector") ? 373 : 0;
      },
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
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
    act(() => {
      root.unmount();
    });
    container.remove();
    if (originalMatchMedia) {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    } else {
      delete (window as Partial<Pick<Window, "matchMedia">>).matchMedia;
    }
    if (originalOffsetWidth) {
      Object.defineProperty(
        HTMLElement.prototype,
        "offsetWidth",
        originalOffsetWidth
      );
    } else {
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    }
    vi.restoreAllMocks();
  });

  function renderSelector() {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <TimeRangeSelector
              value={{
                timeRangeKey: "7d",
                ...getTimeRangeFromLastNTimeRangeKey("7d"),
              }}
              onChange={vi.fn()}
            />
          </PreferencesProvider>
        </ThemeProvider>
      );
    });
  }

  function getPresetListbox() {
    return document.querySelector(
      '[aria-label="time range preset selection"]'
    ) as HTMLElement | null;
  }

  function getPopover() {
    return document.querySelector(".react-aria-Popover") as HTMLElement | null;
  }

  function openPresetListbox() {
    const valueButton = container.querySelector(
      ".time-range-selector__value"
    ) as HTMLButtonElement | null;
    expect(valueButton).not.toBeNull();

    act(() => {
      valueButton?.focus();
    });

    const listbox = getPresetListbox();
    expect(listbox).not.toBeNull();
    return listbox;
  }

  it("closes the preset listbox when Escape is pressed", () => {
    renderSelector();
    openPresetListbox();
    const focusedElement = document.activeElement as HTMLElement | null;

    expect(focusedElement).not.toBeNull();
    expect(focusedElement).not.toBe(document.body);

    act(() => {
      focusedElement?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      );
    });

    expect(getPresetListbox()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("opens the preset listbox at the measured trigger width", () => {
    renderSelector();
    openPresetListbox();

    const valueShell = container.querySelector(
      ".time-range-selector__value-shell"
    ) as HTMLElement | null;

    expect(valueShell?.style.width).toBe("auto");
    expect(getPopover()?.style.width).toBe("373px");
    expect(getPopover()?.style.transition).toBe("none");
  });

  it("opens the preset listbox when non-button selector chrome is pressed", () => {
    renderSelector();
    const selector = container.querySelector(
      ".time-range-selector"
    ) as HTMLDivElement | null;
    expect(selector).not.toBeNull();
    expect(getPresetListbox()).toBeNull();

    act(() => {
      selector?.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "mouse",
        })
      );
    });

    expect(getPresetListbox()).not.toBeNull();
    expect(container.querySelector('[aria-label="Start time"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="End time"]')).not.toBeNull();
  });

  it("focuses the preset listbox when opened while keeping the range fields visible", async () => {
    renderSelector();
    const listbox = openPresetListbox();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.activeElement).toBe(listbox);
    expect(container.querySelector('[aria-label="Start time"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="End time"]')).not.toBeNull();
  });

  it("closes the preset listbox when pressing outside", () => {
    renderSelector();
    openPresetListbox();

    const outsideButton = document.createElement("button");
    document.body.appendChild(outsideButton);

    try {
      act(() => {
        outsideButton.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            pointerType: "mouse",
          })
        );
        outsideButton.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            pointerType: "mouse",
          })
        );
      });

      expect(getPresetListbox()).toBeNull();
    } finally {
      outsideButton.remove();
    }
  });
});
