import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { vi } from "vitest";

import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";

let container: HTMLDivElement;
let root: Root;
let intersectionCallback: IntersectionObserverCallback;
let intersectionOptions: IntersectionObserverInit | undefined;
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
  intersectionOptions = undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    function IntersectionObserverMock(
      callback: IntersectionObserverCallback,
      options?: IntersectionObserverInit
    ) {
      intersectionCallback = callback;
      intersectionOptions = options;
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

describe("LazyEditorWrapper", () => {
  it("mounts the editor immediately when requested", () => {
    act(() => {
      root.render(
        <LazyEditorWrapper
          preInitializationMinHeight={120}
          fallback={<span>Plain JSON</span>}
          initializeImmediately
        >
          <span>Highlighted JSON</span>
        </LazyEditorWrapper>
      );
    });

    expect(container.textContent).toBe("Highlighted JSON");
    expect(observe).not.toHaveBeenCalled();
  });

  it("preloads the editor before its wrapper enters the viewport", () => {
    act(() => {
      root.render(
        <LazyEditorWrapper
          preInitializationMinHeight={120}
          fallback={<span>Plain JSON</span>}
        >
          <span>Highlighted JSON</span>
        </LazyEditorWrapper>
      );
    });

    expect(container.textContent).toBe("Plain JSON");
    expect(observe).toHaveBeenCalledOnce();
    expect(intersectionOptions?.rootMargin).toBe("1200px 0px");
    expect(intersectionOptions?.scrollMargin).toBe("1200px 0px");

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

    expect(container.textContent).toBe("Highlighted JSON");
    expect(disconnect).toHaveBeenCalled();
  });
});
