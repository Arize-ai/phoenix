import { act } from "react";
import type {
  createElement,
  Ref,
  KeyboardEvent as ReactKeyboardEvent,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  TimeRangeSelector,
  type TimeRangeSelectorProps,
} from "../TimeRangeSelector";
import { getTimeRangeFromLastNTimeRangeKey } from "../utils";

vi.mock("../TimeRangeFields", async () => {
  const React = (await vi.importActual("react")) as {
    createElement: typeof createElement;
    useImperativeHandle: typeof useImperativeHandle;
    useLayoutEffect: typeof useLayoutEffect;
    useRef: typeof useRef;
  };

  return {
    TimeRangeFields({
      ref,
      autoFocus,
      onBlurWithin,
      onCommit,
      onEscape,
      onSubmit,
    }: {
      ref?: Ref<{ commit: () => void }>;
      autoFocus?: boolean;
      onBlurWithin?: () => void;
      onCommit: (range: OpenTimeRange) => void;
      onEscape?: () => void;
      onSubmit?: () => void;
    }) {
      const inputRef = React.useRef<HTMLInputElement>(null);

      React.useImperativeHandle(
        ref,
        () => ({
          commit() {
            onCommit({
              start: new Date("2024-01-01T00:00:00.000Z"),
              end: new Date("2024-01-02T00:00:00.000Z"),
            });
          },
        }),
        [onCommit]
      );
      React.useLayoutEffect(() => {
        if (autoFocus) {
          inputRef.current?.focus();
        }
      }, [autoFocus]);

      return React.createElement("input", {
        "aria-label": "mock time range field",
        onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            onCommit({
              start: new Date("2024-01-01T00:00:00.000Z"),
              end: new Date("2024-01-02T00:00:00.000Z"),
            });
            onSubmit?.();
          } else if (event.key === "Escape") {
            onCommit({
              start: new Date("2024-01-01T00:00:00.000Z"),
              end: new Date("2024-01-02T00:00:00.000Z"),
            });
            onEscape?.();
          }
        },
        onBlur: onBlurWithin,
        ref: inputRef,
      });
    },
  };
});

describe("TimeRangeSelector Escape handling", () => {
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

  function renderSelector({
    onChange,
  }: {
    onChange: TimeRangeSelectorProps["onChange"];
  }) {
    act(() => {
      root.render(
        <ThemeProvider themeMode="light" disableBodyTheme>
          <PreferencesProvider>
            <TimeRangeSelector
              value={{
                timeRangeKey: "7d",
                ...getTimeRangeFromLastNTimeRangeKey("7d"),
              }}
              onChange={onChange}
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

  it("commits the active custom range and blurs the field when Escape is pressed", () => {
    const onChange = vi.fn<TimeRangeSelectorProps["onChange"]>();
    renderSelector({ onChange });

    const valueButton = container.querySelector(
      ".time-range-selector__value"
    ) as HTMLButtonElement | null;
    expect(valueButton).not.toBeNull();

    act(() => {
      valueButton?.focus();
    });
    const listbox = getPresetListbox();
    expect(document.activeElement).toBe(listbox);

    const field = container.querySelector(
      '[aria-label="mock time range field"]'
    ) as HTMLInputElement | null;
    expect(field).not.toBeNull();

    act(() => {
      listbox?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextRange = onChange.mock.calls[0]?.[0];
    expect(nextRange?.timeRangeKey).toBe("custom");
    expect(nextRange?.start?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(nextRange?.end?.toISOString()).toBe("2024-01-02T00:00:00.000Z");
    expect(getPresetListbox()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("submits the active custom range and closes when Enter is pressed in the field", () => {
    const onChange = vi.fn<TimeRangeSelectorProps["onChange"]>();
    renderSelector({ onChange });

    const valueButton = container.querySelector(
      ".time-range-selector__value"
    ) as HTMLButtonElement | null;
    expect(valueButton).not.toBeNull();

    act(() => {
      valueButton?.focus();
    });

    const listbox = getPresetListbox();
    expect(document.activeElement).toBe(listbox);

    const field = container.querySelector(
      '[aria-label="mock time range field"]'
    ) as HTMLInputElement | null;
    expect(field).not.toBeNull();

    act(() => {
      field?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Enter" })
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextRange = onChange.mock.calls[0]?.[0];
    expect(nextRange?.timeRangeKey).toBe("custom");
    expect(nextRange?.start?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(nextRange?.end?.toISOString()).toBe("2024-01-02T00:00:00.000Z");
    expect(getPresetListbox()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("blurs the compact value button when Escape is pressed", () => {
    const onChange = vi.fn<TimeRangeSelectorProps["onChange"]>();
    renderSelector({ onChange });

    const valueButton = container.querySelector(
      ".time-range-selector__value"
    ) as HTMLButtonElement | null;
    expect(valueButton).not.toBeNull();

    act(() => {
      valueButton?.focus();
      valueButton?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      );
    });

    expect(onChange).not.toHaveBeenCalled();
    expect(getPresetListbox()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("commits the active custom range and stops editing when Escape is pressed in the field", () => {
    const onChange = vi.fn<TimeRangeSelectorProps["onChange"]>();
    renderSelector({ onChange });

    const valueButton = container.querySelector(
      ".time-range-selector__value"
    ) as HTMLButtonElement | null;
    expect(valueButton).not.toBeNull();

    act(() => {
      valueButton?.focus();
    });

    const field = container.querySelector(
      '[aria-label="mock time range field"]'
    ) as HTMLInputElement | null;
    expect(field).not.toBeNull();

    act(() => {
      field?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Escape" })
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const nextRange = onChange.mock.calls[0]?.[0];
    expect(nextRange?.timeRangeKey).toBe("custom");
    expect(nextRange?.start?.toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(nextRange?.end?.toISOString()).toBe("2024-01-02T00:00:00.000Z");
    expect(getPresetListbox()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});
