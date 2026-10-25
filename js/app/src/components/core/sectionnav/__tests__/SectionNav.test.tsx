import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveActiveSectionId } from "../resolveActiveSectionId";
import { SectionNav, type SectionNavProps } from "../SectionNav";
import { SectionNavSection } from "../SectionNavSection";

describe("resolveActiveSectionId", () => {
  const sections = [
    { id: "annotations", top: 40 },
    { id: "input", top: 400 },
    { id: "output", top: 900 },
  ];

  it("returns null when there are no sections", () => {
    expect(
      resolveActiveSectionId({
        sections: [],
        lineTop: 40,
        isScrolledToEnd: false,
      })
    ).toBeNull();
  });

  it("makes the first section active before any section reaches the line", () => {
    expect(
      resolveActiveSectionId({
        sections: [
          { id: "annotations", top: 120 },
          { id: "input", top: 400 },
        ],
        lineTop: 40,
        isScrolledToEnd: false,
      })
    ).toBe("annotations");
  });

  it("makes the last section whose top is at or above the line active", () => {
    expect(
      resolveActiveSectionId({ sections, lineTop: 400, isScrolledToEnd: false })
    ).toBe("input");
    expect(
      resolveActiveSectionId({ sections, lineTop: 899, isScrolledToEnd: false })
    ).toBe("output");
    expect(
      resolveActiveSectionId({ sections, lineTop: 380, isScrolledToEnd: false })
    ).toBe("annotations");
  });

  it("makes the last section active at the scroll end even if it never reaches the line", () => {
    expect(
      resolveActiveSectionId({ sections, lineTop: 40, isScrolledToEnd: true })
    ).toBe("output");
  });
});

const SECTIONS = [
  { id: "annotations", label: "Annotations" },
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
];

let container: HTMLDivElement;
let root: Root;
let prefersReducedMotion: boolean;
let intersectionCallbacks: IntersectionObserverCallback[];
const scrollIntoView = vi.fn();
const originalScrollIntoView = Element.prototype.scrollIntoView;

// Async so the selection indicator's enter transition, which react-aria
// schedules in a microtask, settles inside act
async function render(props: Partial<SectionNavProps> = {}) {
  await act(async () => {
    root.render(
      <div>
        <SectionNav aria-label="Run details" sections={SECTIONS} {...props} />
        {SECTIONS.map((section) => (
          <SectionNavSection
            key={section.id}
            id={section.id}
            heading={section.label}
          >
            {section.label} content
          </SectionNavSection>
        ))}
      </div>
    );
  });
}

function link(label: string): HTMLAnchorElement {
  const match = Array.from(
    container.querySelectorAll<HTMLAnchorElement>("nav a")
  ).find((anchor) => anchor.textContent === label);
  if (match == null) {
    throw new Error(`no link labeled ${label}`);
  }
  return match;
}

function currentLinks(): string[] {
  return Array.from(container.querySelectorAll("nav a[aria-current]")).map(
    (anchor) => `${anchor.textContent}:${anchor.getAttribute("aria-current")}`
  );
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    );
  });
}

/** Report a scroll-position change the way the browser's observer would */
async function reportIntersection() {
  await act(async () => {
    for (const callback of intersectionCallbacks) {
      callback([], {} as IntersectionObserver);
    }
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  prefersReducedMotion = false;
  intersectionCallbacks = [];
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion")
        ? prefersReducedMotion
        : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  // The shared jsdom setup reports every element as intersecting the moment
  // it is observed; these tests decide when the observer reports instead.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
  // jsdom does not implement scrolling
  Element.prototype.scrollIntoView = scrollIntoView;
  scrollIntoView.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  Element.prototype.scrollIntoView = originalScrollIntoView;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("SectionNav", () => {
  it("renders a labeled navigation landmark of in-page links, not tabs", async () => {
    await render();
    const nav = container.querySelector("nav");
    expect(nav?.getAttribute("aria-label")).toBe("Run details");
    expect(
      Array.from(nav?.querySelectorAll("li > a") ?? []).map((anchor) =>
        anchor.getAttribute("href")
      )
    ).toEqual(["#annotations", "#input", "#output"]);
    expect(container.querySelector("[role=tablist], [role=tab]")).toBeNull();
  });

  it("renders each section as a focusable, labeled section with a heading", async () => {
    await render();
    const section = container.querySelector("section#input");
    expect(section?.getAttribute("tabindex")).toBe("-1");
    const headingId = section?.getAttribute("aria-labelledby");
    expect(headingId).toBeTruthy();
    expect(document.getElementById(headingId ?? "")?.textContent).toBe("Input");
  });

  it("marks the first section current by default", async () => {
    await render();
    expect(currentLinks()).toEqual(["Annotations:true"]);
  });

  it("marks the default active section current", async () => {
    await render({ defaultActiveId: "output" });
    expect(currentLinks()).toEqual(["Output:true"]);
  });

  it("moves aria-current to a clicked link immediately and reports the change", async () => {
    const onChange = vi.fn();
    await render({ onChange });
    await click(link("Input"));
    expect(currentLinks()).toEqual(["Input:true"]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("input");
  });

  it("scrolls the clicked section into view and moves focus into it", async () => {
    await render();
    const anchor = link("Output");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    await act(async () => {
      anchor.dispatchEvent(event);
    });
    const section = container.querySelector("section#output");
    // The link is followed by scrolling, not by navigating to the hash
    expect(event.defaultPrevented).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(scrollIntoView.mock.contexts[0]).toBe(section);
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "smooth",
    });
    expect(document.activeElement).toBe(section);
  });

  it("jumps without smooth scrolling when the user prefers reduced motion", async () => {
    prefersReducedMotion = true;
    await render();
    await click(link("Output"));
    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "auto",
    });
  });

  it("leaves modified clicks to the browser", async () => {
    await render();
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    await act(async () => {
      link("Output").dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(currentLinks()).toEqual(["Annotations:true"]);
  });

  // jsdom has no layout, so every section's top is reported at 0 — at or
  // above the bar's bottom edge — and resolving the scroll position always
  // picks the last section.
  it("follows the scroll position", async () => {
    const onChange = vi.fn();
    await render({ onChange });
    await reportIntersection();
    expect(currentLinks()).toEqual(["Output:true"]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("output");
  });

  it("keeps a clicked link current while its scroll is in progress, then resumes following the scroll position", async () => {
    await render();
    await click(link("Input"));
    // sections passing the bar mid-scroll do not steal the active state
    await reportIntersection();
    expect(currentLinks()).toEqual(["Input:true"]);
    await act(async () => {
      vi.advanceTimersByTime(50);
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(100);
    });
    await reportIntersection();
    expect(currentLinks()).toEqual(["Input:true"]);
    // once scrolling settles, the user's own scrolling is followed again
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(currentLinks()).toEqual(["Input:true"]);
    await reportIntersection();
    expect(currentLinks()).toEqual(["Output:true"]);
  });

  it("keeps the default active section current until the user scrolls", async () => {
    await render({ defaultActiveId: "input" });
    await reportIntersection();
    expect(currentLinks()).toEqual(["Input:true"]);
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    await reportIntersection();
    expect(currentLinks()).toEqual(["Output:true"]);
  });
});
