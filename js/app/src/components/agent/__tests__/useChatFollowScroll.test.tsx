import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useChatFollowScroll } from "../useChatFollowScroll";

let container: HTMLDivElement;
let root: Root;

/** The single ResizeObserver callback the hook registered, for manual firing. */
let resizeCallback: ResizeObserverCallback | null = null;

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
  vi.stubGlobal("ResizeObserver", ControllableResizeObserver);
  resizeCallback = null;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type FollowScroll = ReturnType<typeof useChatFollowScroll>;

function renderFollowScroll(): FollowScroll {
  let value: FollowScroll | null = null;
  function Harness() {
    // eslint-disable-next-line react/globals
    value = useChatFollowScroll();
    return null;
  }
  act(() => {
    root.render(<Harness />);
  });
  if (!value) {
    throw new Error("useChatFollowScroll did not render");
  }
  return value;
}

/**
 * A fake transcript scroller: 500px viewport over adjustable content height.
 */
function createScroller(scrollHeight = 1000) {
  const el = document.createElement("div");
  let height = scrollHeight;
  Object.defineProperty(el, "scrollHeight", {
    get: () => height,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    value: 500,
    configurable: true,
  });
  document.body.appendChild(el);
  return {
    el,
    growContent(by: number) {
      height += by;
    },
    /** Simulate a user-driven scroll to `top` (dispatches a scroll event). */
    userScrollTo(top: number) {
      el.scrollTop = top;
      el.dispatchEvent(new Event("scroll"));
    },
    fireResize() {
      resizeCallback?.([], {} as ResizeObserver);
    },
    maxScrollTop: () => height - 500,
  };
}

describe("useChatFollowScroll", () => {
  it("pins to the bottom on content resize while following", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);

    scroller.growContent(300);
    scroller.fireResize();

    expect(scroller.el.scrollTop).toBe(scroller.maxScrollTop());
  });

  it("a wheel-up anywhere over the scroller releases follow mode", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);
    scroller.fireResize(); // pinned at bottom

    // The wheel may target a deeply nested element (e.g. a tool part body
    // with its own overflow) — the event bubbles to the scroller either way.
    const nested = document.createElement("pre");
    scroller.el.appendChild(nested);
    nested.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -10, bubbles: true })
    );

    const before = scroller.el.scrollTop;
    scroller.growContent(400);
    scroller.fireResize();

    // Free mode: nothing writes scrollTop.
    expect(scroller.el.scrollTop).toBe(before);
  });

  it("an upward user scroll releases follow mode", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);
    scroller.fireResize(); // pinned at 500

    scroller.userScrollTo(200);

    scroller.growContent(400);
    scroller.fireResize();

    expect(scroller.el.scrollTop).toBe(200);
  });

  it("scrolling back down to the bottom re-engages follow mode", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);
    scroller.fireResize();
    scroller.userScrollTo(100); // escape upward

    scroller.userScrollTo(scroller.maxScrollTop() - 10); // return near bottom

    scroller.growContent(200);
    scroller.fireResize();

    expect(scroller.el.scrollTop).toBe(scroller.maxScrollTop());
  });

  it("ignores the scroll event echoed by its own pin", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);

    scroller.growContent(300);
    scroller.fireResize();
    // The pin's own scroll event must not be treated as user intent.
    scroller.el.dispatchEvent(new Event("scroll"));

    scroller.growContent(300);
    scroller.fireResize();

    expect(scroller.el.scrollTop).toBe(scroller.maxScrollTop());
  });

  it("stopScroll releases follow; scrollToBottom re-engages and pins", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);
    scroller.fireResize();

    follow.stopScroll();
    const before = scroller.el.scrollTop;
    scroller.growContent(250);
    scroller.fireResize();
    expect(scroller.el.scrollTop).toBe(before);

    follow.scrollToBottom();
    expect(scroller.el.scrollTop).toBe(scroller.maxScrollTop());
  });
});
