import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpandableSpanContent } from "../ExpandableSpanContent";

type CapturedResizeObserver = {
  callback: ResizeObserverCallback;
  observedElements: Set<Element>;
  observer: ResizeObserver;
};

let container: HTMLDivElement;
let root: Root;
let originalResizeObserver: typeof ResizeObserver;
let originalScrollHeight: PropertyDescriptor | undefined;
let originalClientHeight: PropertyDescriptor | undefined;
let resizeObservers: CapturedResizeObserver[];
let scrollHeight: number;
let jumpTargetDocumentBottom: number;
let collapsedExpandButtonBottom: number;
let notesBarHeight: number;

beforeEach(() => {
  resizeObservers = [];
  scrollHeight = 1200;
  jumpTargetDocumentBottom = 1200;
  collapsedExpandButtonBottom = 100;
  notesBarHeight = 48;
  originalResizeObserver = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class CapturingResizeObserver implements ResizeObserver {
    observedElements = new Set<Element>();

    constructor(callback: ResizeObserverCallback) {
      resizeObservers.push({
        callback,
        observedElements: this.observedElements,
        observer: this,
      });
    }

    observe(element: Element) {
      this.observedElements.add(element);
    }

    unobserve(element: Element) {
      this.observedElements.delete(element);
    }

    disconnect() {
      this.observedElements.clear();
    }
  };

  originalScrollHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "scrollHeight"
  );
  Object.defineProperty(Element.prototype, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  originalClientHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "clientHeight"
  );
  Object.defineProperty(Element.prototype, "clientHeight", {
    configurable: true,
    get: () => 680,
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      if (this.matches(".test-span-details-scroll-container")) {
        return createDOMRect({ bottom: 680, top: 0 });
      }
      if (this.matches("[data-span-details-notes-bar]")) {
        return createDOMRect({
          bottom: 680,
          top: 680 - notesBarHeight,
        });
      }
      if (this.matches(".expandable-span-content__jump-to-end-target")) {
        const scrollTop =
          container.querySelector<HTMLElement>(
            ".test-span-details-scroll-container"
          )?.scrollTop ?? 0;
        const jumpTargetBottom = jumpTargetDocumentBottom - scrollTop;
        return createDOMRect({
          bottom: jumpTargetBottom,
          top: jumpTargetBottom - 1,
        });
      }
      if (this.matches('[aria-label="Show more"]')) {
        return createDOMRect({
          bottom: collapsedExpandButtonBottom,
          top: collapsedExpandButtonBottom - 50,
        });
      }
      if (this.matches(".expandable-content")) {
        return createDOMRect({
          bottom: jumpTargetDocumentBottom + 30,
          top: 100,
        });
      }
      return createDOMRect({ bottom: 0, top: 0 });
    }
  );

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  globalThis.ResizeObserver = originalResizeObserver;
  restoreElementProperty("scrollHeight", originalScrollHeight);
  restoreElementProperty("clientHeight", originalClientHeight);
  vi.restoreAllMocks();
});

function restoreElementProperty(
  property: "scrollHeight" | "clientHeight",
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(Element.prototype, property, descriptor);
  } else {
    Reflect.deleteProperty(Element.prototype, property);
  }
}

function createDOMRect({
  bottom,
  top,
}: {
  bottom: number;
  top: number;
}): DOMRect {
  return {
    x: 0,
    y: top,
    width: 400,
    height: bottom - top,
    top,
    right: 400,
    bottom,
    left: 0,
    toJSON: () => ({}),
  };
}

function renderInSpanDetails(content: ReactNode) {
  root.render(
    <div className="test-span-details-scroll-container">
      <div data-span-details-sections-content>
        {content}
        <div data-span-details-notes-bar />
      </div>
    </div>
  );
}

function renderExpandableSpanContent() {
  act(() => {
    renderInSpanDetails(
      <ExpandableSpanContent>
        <div>content</div>
      </ExpandableSpanContent>
    );
  });
}

function reportElementHeight(element: Element, height: number) {
  for (const { callback, observedElements, observer } of resizeObservers) {
    if (!observedElements.has(element)) {
      continue;
    }
    callback(
      [
        {
          target: element,
          contentRect: {
            x: 0,
            y: 0,
            width: 0,
            height,
            top: 0,
            right: 0,
            bottom: height,
            left: 0,
            toJSON: () => ({}),
          },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      observer
    );
  }
}

function measureContent({ contentHeight }: { contentHeight: number }) {
  const content = container.querySelector<HTMLElement>(
    ".expandable-span-content__body"
  );
  expect(content).not.toBeNull();
  content?.style.setProperty("--global-dimension-size-6000", "480px");

  act(() => {
    reportElementHeight(content!, contentHeight);
  });
}

function expandContent() {
  const expandButton = container.querySelector<HTMLButtonElement>(
    '[aria-label="Show more"]'
  );
  expect(expandButton).not.toBeNull();
  act(() => expandButton?.click());
}

describe("ExpandableSpanContent", () => {
  it("uses a bounded preview until the full content is expanded", () => {
    scrollHeight = 100;
    act(() => {
      renderInSpanDetails(
        <ExpandableSpanContent
          height="md"
          collapsedPreview={<div>bounded preview</div>}
        >
          <div>full content</div>
        </ExpandableSpanContent>
      );
    });

    const expandableContent = container.querySelector<HTMLElement>(
      ".expandable-content"
    );
    expect(expandableContent?.style.maxHeight).toBe(
      "var(--global-expansion-cutoff-md)"
    );
    expect(container.textContent).toContain("bounded preview");
    expect(container.textContent).not.toContain("full content");

    expandContent();
    expect(container.textContent).not.toContain("bounded preview");
    expect(container.textContent).toContain("full content");
  });

  it("offers a jump only when expanded content is taller than size 6000", () => {
    renderExpandableSpanContent();
    measureContent({ contentHeight: 480 });

    expect(container.querySelector("button")?.textContent).toBe("Expand");
    expandContent();
    expect(container.textContent).not.toContain("Jump to end");

    const content = container.querySelector(".expandable-span-content__body");
    act(() => reportElementHeight(content!, 481));
    expect(container.textContent).toContain("Jump to end");

    const collapseButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show less"]'
    );
    act(() => collapseButton?.click());
    expect(container.textContent).not.toContain("Jump to end");
  });

  it("jumps the end of tall expanded content into view", () => {
    renderExpandableSpanContent();
    measureContent({ contentHeight: 1200 });
    expect(container.textContent).not.toContain("Jump to end");
    expandContent();

    const jumpButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Jump to end"
    );
    const jumpTarget = container.querySelector<HTMLElement>(
      ".expandable-span-content__jump-to-end-target"
    );
    const scrollContainer = container.querySelector<HTMLElement>(
      ".test-span-details-scroll-container"
    );
    expect(jumpButton).toBeDefined();
    expect(jumpButton?.getAttribute("data-variant")).toBe("primary");
    expect(jumpTarget).not.toBeNull();
    expect(scrollContainer).not.toBeNull();
    scrollContainer?.style.setProperty("--global-dimension-size-200", "16px");

    act(() => jumpButton?.click());
    // 1200 - (680px scrollport - 48px Notes bar - 16px inset)
    expect(scrollContainer?.scrollTop).toBe(584);

    // Deferred content can increase the distance after the first scroll. The
    // active alignment observer should finish the jump without another click.
    jumpTargetDocumentBottom = 1400;
    const scrollContent = container.querySelector(
      "[data-span-details-sections-content]"
    );
    act(() => reportElementHeight(scrollContent!, 1800));
    expect(scrollContainer?.scrollTop).toBe(784);

    // Browsers can settle on a fractional pixel that cannot produce another
    // meaningful scroll. Treat that as aligned and dismiss the control.
    jumpTargetDocumentBottom = 1400.5;
    act(() => {
      scrollContainer?.dispatchEvent(new Event("scroll"));
    });
    expect(container.textContent).not.toContain("Jump to end");
  });

  it("snaps the restored expand affordance above the notes bar", () => {
    renderExpandableSpanContent();
    measureContent({ contentHeight: 1200 });
    expandContent();

    const scrollContainer = container.querySelector<HTMLElement>(
      ".test-span-details-scroll-container"
    );
    expect(scrollContainer).not.toBeNull();
    scrollContainer?.style.setProperty("--global-dimension-size-200", "16px");
    notesBarHeight = 72;
    if (scrollContainer) {
      scrollContainer.scrollTop = 1000;
    }

    const collapseButton = container.querySelector<HTMLButtonElement>(
      '[aria-label="Show less"]'
    );
    expect(collapseButton).not.toBeNull();
    act(() => collapseButton?.click());

    expect(container.querySelector('[aria-label="Show more"]')).not.toBeNull();
    // 1000 + (100px button bottom - (680px scrollport - 72px Notes bar - 16px inset))
    expect(scrollContainer?.scrollTop).toBe(508);
  });
});
