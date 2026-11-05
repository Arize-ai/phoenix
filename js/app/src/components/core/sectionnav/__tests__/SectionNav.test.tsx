import { act, createRef, type RefObject } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveActiveSectionId } from "../resolveActiveSectionId";
import { createScrollTracking } from "../scrollTracking";
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

  it("counts a section within the tolerance of the line as reached", () => {
    expect(
      resolveActiveSectionId({
        sections,
        lineTop: 899,
        isScrolledToEnd: false,
        tolerance: 0,
      })
    ).toBe("input");
  });

  it("makes the last section active at the scroll end even if it never reaches the line", () => {
    expect(
      resolveActiveSectionId({ sections, lineTop: 40, isScrolledToEnd: true })
    ).toBe("output");
  });
});

describe("createScrollTracking", () => {
  it("follows the scroll position when not paused", () => {
    const tracking = createScrollTracking();
    expect(tracking.isPaused).toBe(false);
    tracking.recordScroll();
    expect(tracking.settle()).toBe(true);
  });

  it("holds a clicked link through the click's own scroll", () => {
    const tracking = createScrollTracking();
    tracking.pause("programmaticallyScrolling");
    tracking.recordScroll();
    tracking.recordScroll();
    expect(tracking.isPaused).toBe(true);
    expect(tracking.settle()).toBe(false);
    expect(tracking.isPaused).toBe(false);
    // later scrolling is the user's and is followed
    tracking.recordScroll();
    expect(tracking.settle()).toBe(true);
  });

  it("follows the user who scrolls elsewhere during a click's scroll", () => {
    const tracking = createScrollTracking();
    tracking.pause("programmaticallyScrolling");
    tracking.recordScroll();
    tracking.recordUserScrollInput();
    expect(tracking.settle()).toBe(true);
    expect(tracking.isPaused).toBe(false);
  });

  it("holds the default section until the user scrolls", () => {
    const tracking = createScrollTracking();
    tracking.pause("holdingDefaultSection");
    expect(tracking.settle()).toBe(false);
    expect(tracking.isPaused).toBe(true);
    tracking.recordScroll();
    expect(tracking.settle()).toBe(true);
    expect(tracking.isPaused).toBe(false);
  });

  it("lets a click replace the held default section", () => {
    const tracking = createScrollTracking();
    tracking.pause("holdingDefaultSection");
    tracking.pause("programmaticallyScrolling");
    tracking.recordScroll();
    expect(tracking.settle()).toBe(false);
    expect(tracking.isPaused).toBe(false);
  });

  it("follows the user who scrolls while the default section is held", () => {
    const tracking = createScrollTracking();
    tracking.pause("holdingDefaultSection");
    tracking.recordScroll();
    expect(tracking.settle()).toBe(true);
  });

  it("forgets user input from before a pause", () => {
    const tracking = createScrollTracking();
    tracking.recordUserScrollInput();
    tracking.pause("programmaticallyScrolling");
    expect(tracking.settle()).toBe(false);
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
const elementScrollTo = vi.fn();
const windowScrollTo = vi.fn();
const originalElementScrollTo = Element.prototype.scrollTo;

// Async so the selection indicator's enter transition, which react-aria
// schedules in a microtask, settles inside act. A given scrollContainerRef
// points at the element wrapping the nav and its sections.
async function render(props: Partial<SectionNavProps> = {}) {
  await act(async () => {
    root.render(
      <div
        ref={
          props.scrollContainerRef as
            | RefObject<HTMLDivElement | null>
            | undefined
        }
      >
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

const intersectionObservers = new Set<ControlledIntersectionObserver>();

class ControlledIntersectionObserver {
  readonly targets = new Set<Element>();
  readonly #callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.#callback = callback;
    intersectionObservers.add(this);
  }
  observe(target: Element) {
    this.targets.add(target);
  }
  unobserve(target: Element) {
    this.targets.delete(target);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
  /** Reports that an observed section crossed the line where sections land */
  report() {
    if (this.targets.size > 0) {
      this.#callback([], this as unknown as IntersectionObserver);
    }
  }
}

// A pane 280px tall scrolling 1000px of sections. The last section is short:
// at the scroll end its top stays 40px below the line.
const PANE_HEIGHT = 280;
const PANE_SCROLL_HEIGHT = 1000;
const SECTION_OFFSETS: Record<string, number> = {
  annotations: 0,
  input: 300,
  output: 760,
};

/** Renders the nav inside a pane with stubbed layout, and returns the pane */
async function renderPane(
  props: Partial<SectionNavProps> = {}
): Promise<HTMLDivElement> {
  const scrollContainerRef = createRef<HTMLDivElement>();
  await render({ ...props, scrollContainerRef });
  const pane = scrollContainerRef.current;
  if (pane == null) {
    throw new Error("pane not rendered");
  }
  vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 480, PANE_HEIGHT)
  );
  Object.defineProperty(pane, "clientHeight", { value: PANE_HEIGHT });
  Object.defineProperty(pane, "scrollHeight", { value: PANE_SCROLL_HEIGHT });
  for (const [id, offset] of Object.entries(SECTION_OFFSETS)) {
    const section = pane.querySelector(`section#${id}`);
    if (section == null) {
      throw new Error(`section ${id} not rendered`);
    }
    vi.spyOn(section, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, offset - pane.scrollTop, 480, 300)
    );
  }
  return pane;
}

/**
 * Scrolls the pane, by the user (a wheel turn) unless the scroll is the nav's
 * own, and reports a section crossing the line unless `crossesLine` is false
 */
async function scrollPane({
  pane,
  scrollTop,
  isUserScroll = true,
  crossesLine = true,
}: {
  pane: HTMLElement;
  scrollTop: number;
  isUserScroll?: boolean;
  crossesLine?: boolean;
}) {
  await act(async () => {
    if (isUserScroll) {
      pane.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    }
    pane.scrollTop = scrollTop;
    pane.dispatchEvent(new Event("scroll"));
    if (crossesLine) {
      for (const observer of intersectionObservers) {
        observer.report();
      }
    }
  });
}

async function settleScroll() {
  await act(async () => {
    vi.advanceTimersByTime(150);
  });
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  prefersReducedMotion = false;
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
  // jsdom has no layout, so every section would resolve as scrolled past.
  // The shared setup's observer reports on observe, which would resolve those
  // meaningless positions on mount; this one reports only when a test says a
  // section crossed the line.
  intersectionObservers.clear();
  vi.stubGlobal("IntersectionObserver", ControlledIntersectionObserver);
  // jsdom does not implement scrolling
  Element.prototype.scrollTo =
    elementScrollTo as typeof Element.prototype.scrollTo;
  vi.stubGlobal("scrollTo", windowScrollTo);
  elementScrollTo.mockClear();
  windowScrollTo.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  Element.prototype.scrollTo = originalElementScrollTo;
  vi.restoreAllMocks();
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

  it("holds the default active section after scrolling to it, until the user scrolls", async () => {
    await render({ defaultActiveId: "input" });
    // jsdom has no layout, so a resolve would mark the last section current
    await act(async () => {
      vi.advanceTimersByTime(150);
      window.dispatchEvent(new Event("resize"));
    });
    expect(currentLinks()).toEqual(["Input:true"]);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(150);
    });
    expect(currentLinks()).toEqual(["Output:true"]);
  });

  it("leaves the pane where it is without a default active section", async () => {
    await render();
    expect(windowScrollTo).not.toHaveBeenCalled();
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
    expect(windowScrollTo).toHaveBeenCalledExactlyOnceWith({
      top: 0,
      behavior: "smooth",
    });
    expect(document.activeElement).toBe(section);
  });

  // jsdom has no layout, so where the section lands is left to the browser
  it("scrolls only the scroll container", async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    await render({ orientation: "vertical", scrollContainerRef });
    await click(link("Output"));
    expect(elementScrollTo).toHaveBeenCalledOnce();
    expect(elementScrollTo.mock.contexts[0]).toBe(scrollContainerRef.current);
    expect(elementScrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: "smooth" })
    );
    expect(windowScrollTo).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "smoothly on mount",
      scrollOn: "mount",
      props: { defaultActiveId: "output" },
      isReducedMotion: false,
      behavior: "smooth",
    },
    {
      name: "instantly on mount when scroll animation is turned off",
      scrollOn: "mount",
      props: { defaultActiveId: "output", isScrollAnimated: false },
      isReducedMotion: false,
      behavior: "instant",
    },
    {
      name: "instantly on mount when the user prefers reduced motion",
      scrollOn: "mount",
      props: { defaultActiveId: "output" },
      isReducedMotion: true,
      behavior: "instant",
    },
    {
      name: "instantly on click when scroll animation is turned off",
      scrollOn: "click",
      props: { isScrollAnimated: false },
      isReducedMotion: false,
      behavior: "instant",
    },
    {
      name: "instantly on click when the user prefers reduced motion",
      scrollOn: "click",
      props: {},
      isReducedMotion: true,
      behavior: "instant",
    },
  ] satisfies {
    name: string;
    scrollOn: "mount" | "click";
    props: Partial<SectionNavProps>;
    isReducedMotion: boolean;
    behavior: ScrollBehavior;
  }[])(
    "scrolls to the section $name",
    async ({ scrollOn, props, isReducedMotion, behavior }) => {
      prefersReducedMotion = isReducedMotion;
      await render(props);
      if (scrollOn === "click") {
        await click(link("Output"));
      }
      expect(windowScrollTo).toHaveBeenCalledExactlyOnceWith({
        top: 0,
        behavior,
      });
    }
  );

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
});

describe("SectionNav scroll tracking", () => {
  it("moves the current link as each section crosses the line", async () => {
    const pane = await renderPane();
    // within a pixel of the line counts as reached
    await scrollPane({ pane, scrollTop: 298 });
    expect(currentLinks()).toEqual(["Annotations:true"]);
    await scrollPane({ pane, scrollTop: 300 });
    expect(currentLinks()).toEqual(["Input:true"]);
    await scrollPane({ pane, scrollTop: 120 });
    expect(currentLinks()).toEqual(["Annotations:true"]);
  });

  it("marks a short last section current once scrolling settles at the end", async () => {
    const pane = await renderPane();
    await scrollPane({ pane, scrollTop: 300 });
    // the short last section never crosses the line
    await scrollPane({
      pane,
      scrollTop: PANE_SCROLL_HEIGHT - PANE_HEIGHT,
      crossesLine: false,
    });
    expect(currentLinks()).toEqual(["Input:true"]);
    await settleScroll();
    expect(currentLinks()).toEqual(["Output:true"]);
  });

  it("keeps a clicked link current through its own scroll", async () => {
    const pane = await renderPane();
    await click(link("Output"));
    // the click's scroll passes Input, then stops short of the short last
    // section, which the scroll position alone would never mark current
    await scrollPane({ pane, scrollTop: 300, isUserScroll: false });
    expect(currentLinks()).toEqual(["Output:true"]);
    await settleScroll();
    expect(currentLinks()).toEqual(["Output:true"]);
    // tracking resumes once the click's scroll settles
    await scrollPane({ pane, scrollTop: 0 });
    expect(currentLinks()).toEqual(["Annotations:true"]);
  });

  it("follows the user who scrolls elsewhere during a click's scroll", async () => {
    const pane = await renderPane();
    await click(link("Output"));
    await scrollPane({ pane, scrollTop: 300 });
    expect(currentLinks()).toEqual(["Output:true"]);
    await settleScroll();
    expect(currentLinks()).toEqual(["Input:true"]);
  });

  it("does not count presses and keys on the pane's content as the user scrolling", async () => {
    const pane = await renderPane();
    const field = document.createElement("input");
    pane.querySelector("section#input")?.append(field);
    await click(link("Output"));
    await scrollPane({ pane, scrollTop: 300, isUserScroll: false });
    await act(async () => {
      field.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );
    });
    await settleScroll();
    expect(currentLinks()).toEqual(["Output:true"]);
  });

  it("counts a press on the pane's own scrollbar as the user scrolling", async () => {
    const pane = await renderPane();
    await click(link("Output"));
    await scrollPane({ pane, scrollTop: 300, isUserScroll: false });
    await act(async () => {
      pane.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    await settleScroll();
    expect(currentLinks()).toEqual(["Input:true"]);
  });

  it("holds the default active section through observer reports until the user scrolls", async () => {
    const pane = await renderPane({ defaultActiveId: "input" });
    // the mount scroll to the default stops short of it
    await scrollPane({ pane, scrollTop: 120, isUserScroll: false });
    await settleScroll();
    await scrollPane({ pane, scrollTop: 120, isUserScroll: false });
    expect(currentLinks()).toEqual(["Input:true"]);
    await scrollPane({ pane, scrollTop: 0 });
    await settleScroll();
    expect(currentLinks()).toEqual(["Annotations:true"]);
  });

  it("does not scroll back to the default active section the user scrolled away from when it re-subscribes", async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    await render({ defaultActiveId: "input", scrollContainerRef });
    const pane = scrollContainerRef.current;
    if (pane == null) {
      throw new Error("pane not rendered");
    }
    expect(elementScrollTo).toHaveBeenCalledOnce();
    // the user scrolls before the mount scroll settles, then the nav
    // re-subscribes (here, to a new orientation)
    await scrollPane({ pane, scrollTop: 0, crossesLine: false });
    await render({
      defaultActiveId: "input",
      scrollContainerRef,
      orientation: "vertical",
    });
    expect(elementScrollTo).toHaveBeenCalledOnce();
  });

  it("reports a change once when the observer reports it twice before re-rendering", async () => {
    const onChange = vi.fn();
    const pane = await renderPane({ onChange });
    await act(async () => {
      pane.scrollTop = 300;
      for (const observer of intersectionObservers) {
        observer.report();
        observer.report();
      }
    });
    expect(currentLinks()).toEqual(["Input:true"]);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("input");
  });

  it("sets the bar's height on the scroll container for sections to land below", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(48);
    const pane = await renderPane();
    expect(pane.style.getPropertyValue("--section-nav-height")).toBe("48px");
    act(() => {
      root.unmount();
    });
    expect(pane.style.getPropertyValue("--section-nav-height")).toBe("");
    root = createRoot(container);
  });

  it("leaves a rail's height out, since it sits beside the sections", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(48);
    const pane = await renderPane({ orientation: "vertical" });
    expect(pane.style.getPropertyValue("--section-nav-height")).toBe("0px");
  });
});
