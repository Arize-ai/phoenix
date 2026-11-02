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
    tracking.noteScroll();
    expect(tracking.settle()).toBe(true);
  });

  it("holds a clicked link through the click's own scroll", () => {
    const tracking = createScrollTracking();
    tracking.pause("scrollToSection");
    tracking.noteScroll();
    tracking.noteScroll();
    expect(tracking.isPaused).toBe(true);
    expect(tracking.settle()).toBe(false);
    expect(tracking.isPaused).toBe(false);
    // later scrolling is the user's and is followed
    tracking.noteScroll();
    expect(tracking.settle()).toBe(true);
  });

  it("follows the user who scrolls elsewhere during a click's scroll", () => {
    const tracking = createScrollTracking();
    tracking.pause("scrollToSection");
    tracking.noteScroll();
    tracking.noteUserScrollInput();
    expect(tracking.settle()).toBe(true);
    expect(tracking.isPaused).toBe(false);
  });

  it("holds the default section until the user scrolls", () => {
    const tracking = createScrollTracking();
    tracking.pause("defaultActiveId");
    expect(tracking.settle()).toBe(false);
    expect(tracking.isPaused).toBe(true);
    tracking.noteScroll();
    expect(tracking.settle()).toBe(true);
    expect(tracking.isPaused).toBe(false);
  });

  it("lets a click replace the held default section", () => {
    const tracking = createScrollTracking();
    tracking.pause("defaultActiveId");
    tracking.pause("scrollToSection");
    tracking.noteScroll();
    expect(tracking.settle()).toBe(false);
    expect(tracking.isPaused).toBe(false);
  });

  it("follows the user who scrolls while the default section is held", () => {
    const tracking = createScrollTracking();
    tracking.pause("defaultActiveId");
    tracking.noteScroll();
    expect(tracking.settle()).toBe(true);
  });

  it("forgets user input from before a pause", () => {
    const tracking = createScrollTracking();
    tracking.noteUserScrollInput();
    tracking.pause("scrollToSection");
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
  // meaningless positions on mount; keep the observer silent so these tests
  // see only the nav's own state. Following real scrolling needs layout, so
  // it is not covered here.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );
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

  it("scrolls only the scroll container, landing the section its scroll margin below the top", async () => {
    const scrollContainerRef = createRef<HTMLDivElement>();
    await render({ orientation: "vertical", scrollContainerRef });
    const pane = scrollContainerRef.current;
    const section = container.querySelector<HTMLElement>("section#output");
    if (pane == null || section == null) {
      throw new Error("pane or section not rendered");
    }
    pane.scrollTop = 40;
    vi.spyOn(pane, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 100, 480, 280)
    );
    vi.spyOn(section, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 600, 480, 120)
    );
    // jsdom does not resolve the section's scroll-margin-top calc
    const getComputedStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
      element === section
        ? ({ scrollMarginTop: "16px" } as CSSStyleDeclaration)
        : getComputedStyle(element)
    );
    await click(link("Output"));
    expect(elementScrollTo).toHaveBeenCalledOnce();
    expect(elementScrollTo.mock.contexts[0]).toBe(pane);
    // the section's offset from the pane's top, plus what is already
    // scrolled, less the gap its scroll-margin-top leaves above it
    expect(elementScrollTo).toHaveBeenCalledWith({
      top: 524,
      behavior: "smooth",
    });
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
