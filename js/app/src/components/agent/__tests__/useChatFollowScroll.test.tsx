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
  it("moves past a stalled native scroll position over plain text in both directions", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller(2000);
    follow.scrollRef(scroller.el);
    scroller.userScrollTo(223);
    const paragraph = document.createElement("p");
    scroller.el.append(paragraph);

    for (const deltaY of [300, 300, -200]) {
      const before = scroller.el.scrollTop;
      const gesture = new WheelEvent("wheel", {
        deltaY,
        bubbles: true,
        cancelable: true,
      });
      paragraph.dispatchEvent(gesture);
      expect(gesture.defaultPrevented).toBe(true);
      expect(scroller.el.scrollTop).toBe(before + deltaY);
    }
    scroller.growContent(100);
    scroller.fireResize();
    expect(scroller.el.scrollTop).toBe(623);
  });

  it("preserves pinch zoom and already handled wheel events", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller();
    follow.scrollRef(scroller.el);
    scroller.userScrollTo(200);
    const zoom = new WheelEvent("wheel", {
      deltaY: 100,
      ctrlKey: true,
      cancelable: true,
    });
    scroller.el.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(false);
    expect(scroller.el.scrollTop).toBe(200);

    const handled = new WheelEvent("wheel", {
      deltaY: 100,
      cancelable: true,
    });
    handled.preventDefault();
    scroller.el.dispatchEvent(handled);
    expect(scroller.el.scrollTop).toBe(200);
  });

  it("scrolls the transcript for vertical trackpad intent over a wide table", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller(2000);
    follow.scrollRef(scroller.el);
    scroller.userScrollTo(200);
    const table = document.createElement("div");
    table.style.overflowX = "auto";
    table.style.overflowY = "auto";
    Object.defineProperties(table, {
      clientWidth: { value: 400 },
      scrollWidth: { value: 600 },
      clientHeight: { value: 100 },
      scrollHeight: { value: 100 },
    });
    scroller.el.append(table);
    const gesture = new WheelEvent("wheel", {
      deltaX: 8,
      deltaY: 300,
      bubbles: true,
      cancelable: true,
    });
    table.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);
    expect(scroller.el.scrollTop).toBe(500);

    const sideways = new WheelEvent("wheel", {
      deltaX: 300,
      deltaY: 8,
      bubbles: true,
      cancelable: true,
    });
    table.dispatchEvent(sideways);
    expect(sideways.defaultPrevented).toBe(false);
    expect(scroller.el.scrollTop).toBe(500);
  });

  it("preserves native scrolling for a vertically scrollable viewer around wide content", () => {
    const follow = renderFollowScroll();
    const scroller = createScroller(2000);
    follow.scrollRef(scroller.el);
    scroller.userScrollTo(200);
    const viewer = document.createElement("div");
    viewer.style.overflowY = "auto";
    Object.defineProperties(viewer, {
      clientHeight: { value: 100 },
      scrollHeight: { value: 500 },
    });
    const wideContent = document.createElement("div");
    wideContent.style.overflowX = "auto";
    Object.defineProperties(wideContent, {
      clientWidth: { value: 400 },
      scrollWidth: { value: 600 },
    });
    viewer.append(wideContent);
    scroller.el.append(viewer);
    const gesture = new WheelEvent("wheel", {
      deltaX: 8,
      deltaY: 300,
      bubbles: true,
      cancelable: true,
    });
    wideContent.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(false);
    expect(scroller.el.scrollTop).toBe(200);
  });
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
