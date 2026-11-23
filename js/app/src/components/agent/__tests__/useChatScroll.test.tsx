import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatScroll } from "../useChatScroll";

let container: HTMLDivElement;
let root: Root;
let resizeCallback: ResizeObserverCallback | null = null;
let nextAnimationFrameId = 1;
let animationFrames = new Map<number, FrameRequestCallback>();
let currentAnimationTime = 0;

class ControllableResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  resizeCallback = null;
  nextAnimationFrameId = 1;
  animationFrames = new Map();
  currentAnimationTime = 0;
  vi.stubGlobal("ResizeObserver", ControllableResizeObserver);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      const frameId = nextAnimationFrameId++;
      animationFrames.set(frameId, callback);
      return frameId;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((frameId: number) => animationFrames.delete(frameId))
  );
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type ChatScroll = ReturnType<typeof useChatScroll>;
let renderedChatScroll: ChatScroll | null = null;

function ChatScrollHarness({ isRequestActive }: { isRequestActive: boolean }) {
  // eslint-disable-next-line react/globals
  renderedChatScroll = useChatScroll({ isRequestActive });
  return null;
}

function renderChatScroll(isRequestActive = false): ChatScroll {
  act(() =>
    root.render(<ChatScrollHarness isRequestActive={isRequestActive} />)
  );
  if (!renderedChatScroll) {
    throw new Error("useChatScroll did not render");
  }
  return renderedChatScroll;
}

function runAnimationFrames(count = 1): void {
  for (let index = 0; index < count; index++) {
    runNextAnimationFrame();
  }
}

function runNextAnimationFrame(frameIntervalMs = 16): void {
  currentAnimationTime += frameIntervalMs;
  const pendingFrames = [...animationFrames.values()];
  animationFrames.clear();
  pendingFrames.forEach((callback) => callback(currentAnimationTime));
}

function createScroller({
  contentHeight = 1000,
  viewportHeight = 500,
}: {
  contentHeight?: number;
  viewportHeight?: number;
} = {}) {
  const scrollElement = document.createElement("div");
  const contentElement = document.createElement("div");
  const turnSpacerElement = document.createElement("div");
  let currentContentHeight = contentHeight;

  scrollElement.appendChild(contentElement);
  contentElement.appendChild(turnSpacerElement);
  document.body.appendChild(scrollElement);

  Object.defineProperty(scrollElement, "clientHeight", {
    get: () => viewportHeight,
  });
  Object.defineProperty(scrollElement, "scrollHeight", {
    get: () =>
      currentContentHeight +
      Number.parseFloat(turnSpacerElement.style.height || "0"),
  });
  vi.spyOn(scrollElement, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: viewportHeight,
    height: viewportHeight,
  } as DOMRect);
  vi.spyOn(turnSpacerElement, "getBoundingClientRect").mockImplementation(
    () =>
      ({
        top: currentContentHeight - scrollElement.scrollTop,
        bottom: currentContentHeight - scrollElement.scrollTop,
      }) as DOMRect
  );

  return {
    contentElement,
    scrollElement,
    turnSpacerElement,
    addUserMessage({ documentTop }: { documentTop: number }) {
      const userElement = document.createElement("div");
      userElement.dataset.chatMessageRole = "user";
      vi.spyOn(userElement, "getBoundingClientRect").mockImplementation(
        () =>
          ({
            top: documentTop - scrollElement.scrollTop,
            bottom: documentTop + 40 - scrollElement.scrollTop,
          }) as DOMRect
      );
      contentElement.insertBefore(userElement, turnSpacerElement);
      return userElement;
    },
    fireResize() {
      resizeCallback?.([], {} as ResizeObserver);
    },
    setContentHeight(nextContentHeight: number) {
      currentContentHeight = nextContentHeight;
    },
  };
}

function attachScrollElements(
  scroll: ChatScroll,
  scroller: ReturnType<typeof createScroller>
) {
  scroll.scrollRef(scroller.scrollElement);
  scroll.contentRef(scroller.contentElement);
  scroll.turnSpacerRef(scroller.turnSpacerElement);
  scroller.fireResize();
}

describe("useChatScroll", () => {
  it("finishes easing when the browser quantizes away the remaining step", () => {
    const scroll = renderChatScroll();
    const scroller = createScroller();
    let quantizedScrollTop = 0;
    Object.defineProperty(scroller.scrollElement, "scrollTop", {
      get: () => quantizedScrollTop,
      set: (nextScrollTop: number) => {
        quantizedScrollTop = Math.round(nextScrollTop);
      },
    });
    scroller.addUserMessage({ documentTop: 800 });
    attachScrollElements(scroll, scroller);
    scroll.startTurn();
    scroller.addUserMessage({ documentTop: 980.7 });
    scroller.setContentHeight(1020);
    scroller.fireResize();

    runAnimationFrames(80);

    expect(scroller.scrollElement.scrollTop).toBe(831);
    expect(animationFrames.size).toBe(0);
  });

  it("cancels smooth following as soon as the user interacts", () => {
    const scroll = renderChatScroll();
    const scroller = createScroller();
    scroller.addUserMessage({ documentTop: 800 });
    attachScrollElements(scroll, scroller);
    scroll.startTurn();
    scroller.addUserMessage({ documentTop: 980 });
    scroller.setContentHeight(1020);
    scroller.fireResize();
    runAnimationFrames(80);
    const anchoredScrollTop = scroller.scrollElement.scrollTop;

    scroller.setContentHeight(anchoredScrollTop + 560);
    scroller.fireResize();
    scroller.scrollElement.dispatchEvent(new WheelEvent("wheel"));
    runAnimationFrames(10);

    expect(animationFrames.size).toBe(0);
    expect(scroller.scrollElement.scrollTop).toBe(anchoredScrollTop);
  });

  it("restores turn placement when an active draft remounts as a session", () => {
    const scroll = renderChatScroll(true);
    const scroller = createScroller({ contentHeight: 1020 });
    scroller.addUserMessage({ documentTop: 980 });

    attachScrollElements(scroll, scroller);

    expect(scroller.turnSpacerElement.style.height).toBe("452px");
    expect(scroller.scrollElement.scrollTop).toBe(0);
    expect(animationFrames.size).toBe(1);

    runAnimationFrames(80);
    expect(scroller.scrollElement.scrollTop).toBeCloseTo(964, 0);
  });
});
