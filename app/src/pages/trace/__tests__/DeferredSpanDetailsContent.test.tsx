import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { DeferredSpanDetailsContent } from "../DeferredSpanDetailsContent";

let container: HTMLDivElement;
let root: Root;
let intersectionCallback: IntersectionObserverCallback;
const observe = vi.fn();
const disconnect = vi.fn();
const intersectionObserverMock = {
  disconnect,
  observe,
  root: null,
  rootMargin: "0px",
  scrollMargin: "0px",
  takeRecords: () => [],
  thresholds: [0],
  unobserve: vi.fn(),
} satisfies IntersectionObserver;

beforeEach(() => {
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    "IntersectionObserver",
    function IntersectionObserverMock(callback: IntersectionObserverCallback) {
      intersectionCallback = callback;
      return intersectionObserverMock;
    }
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

describe("DeferredSpanDetailsContent", () => {
  it("shows its fallback until the region enters the viewport", () => {
    act(() => {
      root.render(
        <DeferredSpanDetailsContent
          fallback={<span>Attributes</span>}
          observeAfterFallback
          placeholderHeight={280}
        >
          <span>Hydrated attributes</span>
        </DeferredSpanDetailsContent>
      );
    });

    expect(container.textContent).toBe("Attributes");
    expect(
      container.querySelector('[data-deferred-content="pending"]')
    ).not.toBeNull();
    expect(observe).toHaveBeenCalledOnce();
    expect(observe).toHaveBeenCalledWith(
      container.querySelector("[data-deferred-observation-target]")
    );

    act(() => {
      const bounds = new DOMRect();
      const entry = {
        boundingClientRect: bounds,
        intersectionRatio: 1,
        intersectionRect: bounds,
        isIntersecting: true,
        rootBounds: null,
        target: container,
        time: 0,
      } satisfies IntersectionObserverEntry;
      intersectionCallback([entry], intersectionObserverMock);
    });

    expect(container.textContent).toBe("Hydrated attributes");
    expect(
      container.querySelector('[data-deferred-content="mounted"]')
    ).not.toBeNull();
    expect(disconnect).toHaveBeenCalled();
  });
});
