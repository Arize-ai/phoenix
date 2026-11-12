import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { ThemeProvider } from "@phoenix/contexts";

import { Counter, type CounterProps } from "../Counter";

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

function render(props: CounterProps) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="dark">
        <Counter {...props} />
      </ThemeProvider>
    );
  });
}

function visibleText(): string | null {
  return container.querySelector(".counter")?.textContent ?? null;
}

function hiddenText(): string | null {
  return container.querySelector(".visually-hidden")?.textContent ?? null;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("Counter", () => {
  it("shows the count with grouping and gives the full count to assistive technology", () => {
    render({ count: 1234 });
    expect(visibleText()).toBe("1,234");
    expect(hiddenText()).toBe(" (1,234)");
    expect(
      container.querySelector(".counter")?.getAttribute("aria-hidden")
    ).toBe("true");
  });

  it("caps a count above max while keeping the full count accessible", () => {
    render({ count: 1000, max: 99 });
    expect(visibleText()).toBe("99+");
    expect(hiddenText()).toBe(" (1,000)");
  });

  it("shows a count equal to max in full", () => {
    render({ count: 99, max: 99 });
    expect(visibleText()).toBe("99");
  });

  it("abbreviates with compact notation", () => {
    render({ count: 1234, notation: "compact" });
    expect(visibleText()).toBe("1.23K");
    expect(hiddenText()).toBe(" (1,234)");
  });

  it("leaves small counts unpadded with compact notation", () => {
    render({ count: 42, notation: "compact" });
    expect(visibleText()).toBe("42");
  });

  it("caps an abbreviated count without padding the cap", () => {
    render({ count: 1000, max: 99, notation: "compact" });
    expect(visibleText()).toBe("99+");
  });

  it("renders zero by default", () => {
    render({ count: 0 });
    expect(visibleText()).toBe("0");
  });

  it("renders nothing for zero when showZero is off", () => {
    render({ count: 0, showZero: false });
    expect(container.textContent).toBe("");
  });

  it("shows a placeholder for an unknown count and adds nothing to the accessible name", () => {
    render({ count: null });
    expect(visibleText()).toBe("--");
    expect(hiddenText()).toBeNull();
  });
});
