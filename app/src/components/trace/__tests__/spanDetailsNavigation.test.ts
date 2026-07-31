import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { beginOptimisticSpanTableNavigation } from "../spanDetailsNavigation";

describe("beginOptimisticSpanTableNavigation", () => {
  const scheduledFrames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  beforeEach(() => {
    scheduledFrames.clear();
    nextFrameId = 1;
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
      vi.fn((frameId: number) => scheduledFrames.delete(frameId))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("invalidates stale details and selects the row before navigating", () => {
    document.body.innerHTML = `
      <main>
        <table>
          <tbody>
            <tr id="old-row" data-selected="true"><td>Old span</td></tr>
            <tr id="target-row"><td><a id="target-link">Target span</a></td></tr>
          </tbody>
        </table>
        <div data-span-details-state="hydrating" data-span-details-target-id="old-span">
          <div data-span-details-skeleton hidden></div>
          <div data-span-details-retained-id="old-span"></div>
        </div>
        <div data-span-navigation-state="hydrated" data-span-navigation-trace-id="old-trace">
          <div data-span-navigation-skeleton hidden></div>
          <div data-span-navigation-content>Old trace tree</div>
        </div>
      </main>
    `;
    const trigger = document.querySelector<HTMLElement>("#target-link");
    const oldRow = document.querySelector<HTMLTableRowElement>("#old-row");
    const targetRow =
      document.querySelector<HTMLTableRowElement>("#target-row");
    const detailsGate = document.querySelector<HTMLElement>(
      "[data-span-details-state]"
    );
    const skeleton = document.querySelector<HTMLElement>(
      "[data-span-details-skeleton]"
    );
    const retainedDetails = document.querySelector<HTMLElement>(
      "[data-span-details-retained-id]"
    );
    const navigationGate = document.querySelector<HTMLElement>(
      "[data-span-navigation-state]"
    );
    const navigationSkeleton = document.querySelector<HTMLElement>(
      "[data-span-navigation-skeleton]"
    );
    const navigationContent = document.querySelector<HTMLElement>(
      "[data-span-navigation-content]"
    );
    const onNavigate = vi.fn();
    if (
      !trigger ||
      !oldRow ||
      !targetRow ||
      !detailsGate ||
      !skeleton ||
      !retainedDetails ||
      !navigationGate ||
      !navigationSkeleton ||
      !navigationContent
    ) {
      throw new Error("Expected optimistic navigation fixtures");
    }

    beginOptimisticSpanTableNavigation({
      onNavigate,
      spanNodeId: "target-span",
      traceId: "target-trace",
      trigger,
    });

    expect(oldRow.dataset.selected).toBe("false");
    expect(targetRow.dataset.selected).toBe("true");
    expect(detailsGate.dataset.spanDetailsTargetId).toBe("target-span");
    expect(detailsGate.dataset.spanDetailsState).toBe("dehydrated");
    expect(skeleton.hidden).toBe(false);
    expect(retainedDetails.hidden).toBe(true);
    expect(navigationGate.dataset.spanNavigationState).toBe("dehydrated");
    expect(navigationSkeleton.hidden).toBe(false);
    expect(navigationContent.hidden).toBe(true);
    expect(onNavigate).not.toHaveBeenCalled();

    const runNextFrame = () => {
      const nextFrame = scheduledFrames.entries().next().value;
      if (!nextFrame) throw new Error("Expected a scheduled animation frame");
      const [frameId, callback] = nextFrame;
      scheduledFrames.delete(frameId);
      callback(performance.now());
    };
    runNextFrame();
    expect(onNavigate).not.toHaveBeenCalled();
    runNextFrame();
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("selects a same-trace tree node without replacing the sidebar", () => {
    document.body.innerHTML = `
      <main>
        <table><tbody><tr id="target-row"><td>Target span</td></tr></tbody></table>
        <div data-span-details-state="hydrating">
          <div data-span-details-skeleton hidden></div>
        </div>
        <div data-span-navigation-state="hydrated" data-span-navigation-trace-id="current-trace">
          <div data-span-navigation-skeleton hidden></div>
          <div data-span-navigation-content>
            <div data-trace-tree-span-node-id="old-span" data-selected="true" class="is-selected"></div>
            <div data-trace-tree-span-node-id="target-span" data-selected="false"></div>
          </div>
        </div>
      </main>
    `;
    const trigger = document.querySelector<HTMLElement>("#target-row");
    const navigationSkeleton = document.querySelector<HTMLElement>(
      "[data-span-navigation-skeleton]"
    );
    const navigationContent = document.querySelector<HTMLElement>(
      "[data-span-navigation-content]"
    );
    const oldTreeNode = document.querySelector<HTMLElement>(
      '[data-trace-tree-span-node-id="old-span"]'
    );
    const targetTreeNode = document.querySelector<HTMLElement>(
      '[data-trace-tree-span-node-id="target-span"]'
    );
    if (
      !trigger ||
      !navigationSkeleton ||
      !navigationContent ||
      !oldTreeNode ||
      !targetTreeNode
    ) {
      throw new Error("Expected same-trace navigation fixtures");
    }

    beginOptimisticSpanTableNavigation({
      onNavigate: vi.fn(),
      spanNodeId: "target-span",
      traceId: "current-trace",
      trigger,
    });

    expect(oldTreeNode.dataset.selected).toBe("false");
    expect(oldTreeNode.classList.contains("is-selected")).toBe(false);
    expect(targetTreeNode.dataset.selected).toBe("true");
    expect(targetTreeNode.classList.contains("is-selected")).toBe(true);
    expect(navigationSkeleton.hidden).toBe(true);
    expect(navigationContent.hidden).toBe(false);
  });
});
