import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SpanAttributesSection } from "../SpanAttributesSection";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function getToggle(): HTMLButtonElement {
  const toggle = container.querySelector<HTMLButtonElement>(
    "button[aria-controls]"
  );
  if (toggle === null) {
    throw new Error("Attributes disclosure toggle was not rendered");
  }
  return toggle;
}

describe("SpanAttributesSection", () => {
  it("renders one section heading and controls its attributes body", () => {
    const onOpenChange = vi.fn();
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <SpanAttributesSection
            attributes={JSON.stringify({ first: 1, nested: { second: 2 } })}
            onOpenChange={onOpenChange}
          />
        </ThemeProvider>
      );
    });

    expect(
      container.querySelectorAll(".span-details-section-heading")
    ).toHaveLength(1);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

    const toggle = getToggle();
    const bodyId = toggle.getAttribute("aria-controls");
    const body = bodyId ? document.getElementById(bodyId) : null;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body?.hidden).toBe(false);

    act(() => toggle.click());

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(body?.hidden).toBe(true);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
