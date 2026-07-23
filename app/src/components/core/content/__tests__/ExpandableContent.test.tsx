import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExpandableContent } from "../ExpandableContent";

let container: HTMLDivElement;
let root: Root;
let originalScrollHeight: PropertyDescriptor | undefined;

// jsdom has no layout, so `scrollHeight` is always 0. Stub it with a mutable
// backing value so a test can simulate content growing/shrinking. Note jsdom
// defines `scrollHeight` on `Element.prototype` (not `HTMLElement.prototype`),
// so we capture/restore the descriptor there to avoid leaking the stub.
let scrollHeightValue = 0;

function mockScrollHeight(value: number) {
  scrollHeightValue = value;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  scrollHeightValue = 0;
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
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  if (originalScrollHeight) {
    Object.defineProperty(
      Element.prototype,
      "scrollHeight",
      originalScrollHeight
    );
  } else {
    // Defensive: if a future jsdom stops defining scrollHeight, drop our stub
    // rather than leaving it installed for later tests in this process.
    delete (Element.prototype as { scrollHeight?: number }).scrollHeight;
  }
  vi.restoreAllMocks();
});

function renderExpandable(props: {
  isExpanded?: boolean;
  onExpandedChange?: (next: boolean) => void;
}) {
  act(() => {
    root.render(
      <ExpandableContent height={320} expandedBehavior="grow" {...props}>
        <div>content</div>
      </ExpandableContent>
    );
  });
}

describe("ExpandableContent", () => {
  it("shows an expand affordance when content exceeds the collapsed height", () => {
    mockScrollHeight(500);
    renderExpandable({});
    expect(container.querySelector('[aria-label="Show more"]')).not.toBeNull();
  });

  it("hides the expand affordance when content fits", () => {
    mockScrollHeight(100);
    renderExpandable({});
    expect(container.querySelector('[aria-label="Show more"]')).toBeNull();
  });

  it("reports changes and swaps the affordance in controlled mode", () => {
    mockScrollHeight(500);
    const onExpandedChange = vi.fn();

    renderExpandable({ isExpanded: false, onExpandedChange });
    const expandButton = container.querySelector(
      '[aria-label="Show more"]'
    ) as HTMLButtonElement | null;
    expect(expandButton).not.toBeNull();

    act(() => {
      expandButton?.click();
    });
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    // Controlled mode: the parent drives the expanded prop. Once expanded, the
    // expand affordance is replaced by a collapse affordance.
    renderExpandable({ isExpanded: true, onExpandedChange });
    expect(container.querySelector('[aria-label="Show less"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Show more"]')).toBeNull();
  });

  it("re-checks overflow when the observed content resizes", () => {
    // Production relies on a ResizeObserver to catch async reflow (CodeMirror
    // init, image load) after the initial synchronous check. Capture the
    // observer callback so we can drive a later resize by hand.
    let resizeCallback: ResizeObserverCallback | null = null;
    const realResizeObserver = globalThis.ResizeObserver;
    class CapturingResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = CapturingResizeObserver;

    try {
      mockScrollHeight(100);
      renderExpandable({});
      expect(container.querySelector('[aria-label="Show more"]')).toBeNull();
      expect(resizeCallback).not.toBeNull();

      // Content grows past the collapsed height, then the observer fires.
      mockScrollHeight(500);
      const dummyObserver: ResizeObserver = {
        observe() {},
        unobserve() {},
        disconnect() {},
      };
      act(() => {
        resizeCallback?.([], dummyObserver);
      });
      expect(
        container.querySelector('[aria-label="Show more"]')
      ).not.toBeNull();
    } finally {
      globalThis.ResizeObserver = realResizeObserver;
    }
  });
});
