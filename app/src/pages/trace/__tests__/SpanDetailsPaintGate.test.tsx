import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SpanDetailsPaintGate } from "../SpanDetailsPaintGate";

vi.mock("../SpanDetails", () => ({
  SpanDetails: ({ spanNodeId }: { spanNodeId: string }) => (
    <div>{`Hydrated ${spanNodeId}`}</div>
  ),
}));

vi.mock("../TraceDetailsSkeleton", () => ({
  SpanDetailsSkeleton: () => <div>Loading span details</div>,
}));

describe("SpanDetailsPaintGate", () => {
  let container: HTMLDivElement;
  let root: Root;
  let nextFrameId: number;
  let scheduledFrames: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    nextFrameId = 1;
    scheduledFrames = new Map();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId;
        nextFrameId += 1;
        scheduledFrames.set(frameId, callback);
        return frameId;
      })
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => {
        scheduledFrames.delete(frameId);
      })
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

  function runNextFrame() {
    const nextFrame = scheduledFrames.entries().next().value;
    if (nextFrame == null) {
      throw new Error("Expected an animation frame to be scheduled");
    }
    const [frameId, callback] = nextFrame;
    scheduledFrames.delete(frameId);
    act(() => callback(0));
  }

  it("paints the skeleton for a frame before hydrating cached details", () => {
    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-a" />);
    });
    expect(container.textContent).toBe("Loading span details");

    runNextFrame();
    expect(container.textContent).toBe("Loading span details");

    runNextFrame();
    expect(container.textContent).toBe("Hydrated span-a");

    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-b" />);
    });
    expect(container.textContent).toBe("Loading span details");

    runNextFrame();
    expect(container.textContent).toBe("Loading span details");

    runNextFrame();
    expect(container.textContent).toBe("Hydrated span-b");
  });

  it("cancels stale hydration when the target changes rapidly", () => {
    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-a" />);
    });
    runNextFrame();

    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-b" />);
    });
    expect(scheduledFrames.size).toBe(1);

    runNextFrame();
    runNextFrame();
    expect(container.textContent).toBe("Hydrated span-b");
  });
});
