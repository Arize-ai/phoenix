import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatScrollContext } from "../ChatScrollContext";
import { useScrollAnchor } from "../scrollAnchor";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
  vi.restoreAllMocks();
});

type Anchor = ReturnType<typeof useScrollAnchor>;

/** Builds a full DOMRect for getBoundingClientRect mocks. */
function makeRect(overrides: Partial<DOMRect>): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...overrides,
  };
}

/**
 * Renders the hook inside a chat scroll context and returns its (stable)
 * `capture`/`restore` callbacks for direct invocation.
 */
function renderScrollAnchor(stopScroll: () => void): Anchor {
  let value: Anchor | null = null;
  function Harness() {
    value = useScrollAnchor();
    return null;
  }
  act(() => {
    root.render(
      <ChatScrollContext.Provider value={{ stopScroll }}>
        <Harness />
      </ChatScrollContext.Provider>
    );
  });
  if (!value) {
    throw new Error("useScrollAnchor did not render");
  }
  return value;
}

describe("useScrollAnchor", () => {
  it("stops stick-to-bottom on capture even when there is no scrollable ancestor", () => {
    // This is the regression guard: a section whose expansion is what first
    // creates overflow has no scrollable ancestor at capture time, but we must
    // still stop stick-to-bottom so it can't snap the transcript to the bottom.
    const stopScroll = vi.fn();
    const anchor = renderScrollAnchor(stopScroll);

    const el = document.createElement("div");
    document.body.appendChild(el); // body is not a scroll container

    anchor.capture(el);

    expect(stopScroll).toHaveBeenCalledTimes(1);
    // With no anchor recorded, restore must be a safe no-op.
    expect(() => anchor.restore(el)).not.toThrow();
  });

  it("restores the anchored element to its prior position after a reflow", () => {
    const stopScroll = vi.fn();
    const anchor = renderScrollAnchor(stopScroll);

    const scrollParent = document.createElement("div");
    Object.defineProperty(scrollParent, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(scrollParent, "clientHeight", {
      value: 500,
      configurable: true,
    });
    scrollParent.scrollTop = 100;
    const el = document.createElement("div");
    scrollParent.appendChild(el);
    document.body.appendChild(scrollParent);

    vi.spyOn(window, "getComputedStyle").mockImplementation((node: Element) => {
      const style = document.createElement("div").style;
      style.overflowY = node === scrollParent ? "auto" : "visible";
      return style;
    });
    vi.spyOn(scrollParent, "getBoundingClientRect").mockReturnValue(
      makeRect({ top: 0 })
    );
    const elementRect = vi.spyOn(el, "getBoundingClientRect");
    elementRect.mockReturnValue(makeRect({ top: 200 }));

    anchor.capture(el);
    expect(stopScroll).toHaveBeenCalledTimes(1);

    // Simulate content above the element growing by 60px after expansion.
    elementRect.mockReturnValue(makeRect({ top: 260 }));
    anchor.restore(el);

    // scrollTop advances by the 60px delta so the element stays visually put.
    expect(scrollParent.scrollTop).toBe(160);
  });
});
