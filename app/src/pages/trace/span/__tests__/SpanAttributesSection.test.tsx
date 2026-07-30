import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SpanAttributesSection } from "../SpanAttributesSection";

let container: HTMLDivElement;
let root: Root;
let originalScrollHeight: PropertyDescriptor | undefined;
let scrollHeightValue = 0;

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
  originalScrollHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollHeight"
  );
  Object.defineProperty(Element.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return scrollHeightValue;
    },
  });
  scrollHeightValue = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  if (originalScrollHeight) {
    Object.defineProperty(
      Element.prototype,
      "scrollHeight",
      originalScrollHeight
    );
  } else {
    delete (Element.prototype as { scrollHeight?: number }).scrollHeight;
  }
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
    expect(getComputedStyle(container.querySelector("thead")!).position).toBe(
      "static"
    );

    const toggle = getToggle();
    const bodyId = toggle.getAttribute("aria-controls");
    const body = bodyId ? document.getElementById(bodyId) : null;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(body?.hidden).toBe(false);

    const titleRegion = container.querySelector<HTMLElement>(
      ".span-details-section-heading__title"
    );
    if (titleRegion === null) {
      throw new Error("Attributes title region was not rendered");
    }
    act(() => titleRegion.click());

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(body?.hidden).toBe(true);
    expect(
      container
        .querySelector(".span-details-section-heading__header")
        ?.getAttribute("data-collapsed")
    ).toBe("true");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    act(() => toggle.click());
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("offers to expand an attributes table taller than its generous preview", () => {
    scrollHeightValue = 800;
    act(() => {
      root.render(
        <ThemeProvider themeMode="dark" disableBodyTheme>
          <SpanAttributesSection
            attributes={JSON.stringify({ first: 1, second: 2 })}
          />
        </ThemeProvider>
      );
    });

    const expandableContent = container.querySelector<HTMLElement>(
      ".expandable-content"
    );
    expect(expandableContent?.style.maxHeight).toBe("640px");

    const expandButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show more"]'
    );
    expect(expandButton).not.toBeNull();

    act(() => expandButton?.click());

    expect(expandableContent?.style.maxHeight).toBe("");
    expect(container.querySelector('[aria-label="Show less"]')).not.toBeNull();
  });
});
