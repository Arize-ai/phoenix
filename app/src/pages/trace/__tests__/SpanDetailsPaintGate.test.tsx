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

  function getSkeleton() {
    const skeleton = container.querySelector<HTMLElement>(
      "[data-span-details-skeleton]"
    );
    if (!skeleton) throw new Error("Expected the details skeleton to exist");
    return skeleton;
  }

  function getRetainedDetails(spanNodeId?: string) {
    return container.querySelector<HTMLElement>(
      spanNodeId
        ? `[data-span-details-retained-id="${spanNodeId}"]`
        : "[data-span-details-retained-id]"
    );
  }

  it("paints the skeleton for a frame before hydrating cached details", () => {
    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-a" />);
    });
    expect(getSkeleton().hidden).toBe(false);
    expect(getRetainedDetails()).toBeNull();
    expect(
      container
        .querySelector("[data-span-details-state]")
        ?.getAttribute("data-span-details-state")
    ).toBe("dehydrated");

    runNextFrame();
    expect(getSkeleton().hidden).toBe(false);

    runNextFrame();
    expect(getSkeleton().hidden).toBe(true);
    expect(getRetainedDetails()?.textContent).toBe("Hydrated span-a");
    expect(
      container
        .querySelector("[data-span-details-state]")
        ?.getAttribute("data-span-details-state")
    ).toBe("hydrating");

    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-b" />);
    });
    expect(getSkeleton().hidden).toBe(false);
    expect(getRetainedDetails()).toHaveProperty("hidden", true);
    expect(getRetainedDetails()?.textContent).toBe("Hydrated span-a");

    runNextFrame();
    expect(getSkeleton().hidden).toBe(false);
    expect(getRetainedDetails()).toHaveProperty("hidden", true);

    runNextFrame();
    expect(getSkeleton().hidden).toBe(true);
    expect(getRetainedDetails("span-a")).toHaveProperty("hidden", true);
    expect(getRetainedDetails("span-b")).toHaveProperty("hidden", false);
    expect(getRetainedDetails("span-b")?.textContent).toBe("Hydrated span-b");
  });

  it("reveals a cached span immediately and evicts the least recent span", () => {
    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-a" />);
    });
    runNextFrame();
    runNextFrame();
    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-b" />);
    });
    runNextFrame();
    runNextFrame();

    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-a" />);
    });
    expect(getSkeleton().hidden).toBe(true);
    expect(getRetainedDetails("span-a")).toHaveProperty("hidden", false);
    expect(getRetainedDetails("span-b")).toHaveProperty("hidden", true);
    expect(scheduledFrames.size).toBe(0);

    act(() => {
      root.render(<SpanDetailsPaintGate spanNodeId="span-c" />);
    });
    expect(getSkeleton().hidden).toBe(false);
    runNextFrame();
    runNextFrame();
    expect(getRetainedDetails("span-a")).not.toBeNull();
    expect(getRetainedDetails("span-b")).toBeNull();
    expect(getRetainedDetails("span-c")).toHaveProperty("hidden", false);
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
    expect(getSkeleton().hidden).toBe(true);
    expect(getRetainedDetails("span-b")?.textContent).toBe("Hydrated span-b");
  });
});
