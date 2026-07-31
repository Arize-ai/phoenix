import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeContext } from "@phoenix/contexts/ThemeContext";

import { SessionDetailsPaginator } from "../SessionDetailsPaginator";
import { SessionPaginationContext } from "../SessionPaginationContext";
import { TraceDetailsPaginator } from "../TraceDetailsPaginator";
import { TracePaginationContext } from "../TracePaginationContext";

describe("details paginator navigation", () => {
  const scheduledFrames = new Map<number, FrameRequestCallback>();
  let container: HTMLDivElement;
  let nextFrameId = 1;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
    if (!nextFrame) throw new Error("Expected a scheduled animation frame");
    const [frameId, callback] = nextFrame;
    scheduledFrames.delete(frameId);
    callback(performance.now());
  }

  it("invalidates trace navigation and details before moving to the next trace", () => {
    const next = vi.fn();
    act(() => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            systemTheme: "light",
            themeMode: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <TracePaginationContext.Provider
            value={{
              traceSequence: [
                { traceId: "current-trace", spanId: "current-span" },
                { traceId: "next-trace", spanId: "next-span" },
              ],
              next,
              previous: vi.fn(),
              setTraceSequence: vi.fn(),
            }}
          >
            <main>
              <TraceDetailsPaginator
                currentId="current-span"
                isCollapsed={false}
              />
              <div
                data-span-navigation-state="hydrated"
                data-span-navigation-trace-id="current-trace"
              >
                <div data-span-navigation-skeleton hidden />
                <div data-span-navigation-content>Current trace</div>
              </div>
              <div
                data-span-details-state="hydrating"
                data-span-details-target-id="current-span"
              >
                <div data-span-details-skeleton hidden />
                <div data-span-details-retained-id="current-span" />
              </div>
            </main>
          </TracePaginationContext.Provider>
        </ThemeContext.Provider>
      );
    });

    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next trace"]'
    );
    act(() => nextButton?.click());

    const navigationGate = container.querySelector<HTMLElement>(
      "[data-span-navigation-state]"
    );
    const navigationSkeleton = container.querySelector<HTMLElement>(
      "[data-span-navigation-skeleton]"
    );
    const navigationContent = container.querySelector<HTMLElement>(
      "[data-span-navigation-content]"
    );
    const detailsGate = container.querySelector<HTMLElement>(
      "[data-span-details-state]"
    );
    const detailsSkeleton = container.querySelector<HTMLElement>(
      "[data-span-details-skeleton]"
    );
    const retainedDetails = container.querySelector<HTMLElement>(
      "[data-span-details-retained-id]"
    );
    expect(navigationGate?.dataset.spanNavigationState).toBe("dehydrated");
    expect(navigationSkeleton?.hidden).toBe(false);
    expect(navigationContent?.hidden).toBe(true);
    expect(detailsGate?.dataset.spanDetailsTargetId).toBe("next-span");
    expect(detailsGate?.dataset.spanDetailsState).toBe("dehydrated");
    expect(detailsSkeleton?.hidden).toBe(false);
    expect(retainedDetails?.hidden).toBe(true);
    expect(next).not.toHaveBeenCalled();

    runNextFrame();
    expect(next).not.toHaveBeenCalled();
    runNextFrame();
    expect(next).toHaveBeenCalledWith("current-span");
  });

  it("publishes the next session preview before moving to its route", () => {
    const next = vi.fn();
    const onNavigateStart = vi.fn();
    act(() => {
      root.render(
        <ThemeContext.Provider
          value={{
            theme: "light",
            systemTheme: "light",
            themeMode: "light",
            setThemeMode: vi.fn(),
          }}
        >
          <SessionPaginationContext.Provider
            value={{
              sessionSequence: [
                { sessionId: "current-session" },
                { sessionId: "next-session" },
              ],
              next,
              previous: vi.fn(),
              setSessionSequence: vi.fn(),
            }}
          >
            <main>
              <SessionDetailsPaginator
                currentId="current-session"
                isCollapsed={false}
                onNavigateStart={onNavigateStart}
              />
            </main>
          </SessionPaginationContext.Provider>
        </ThemeContext.Provider>
      );
    });

    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Next session"]'
    );
    act(() => nextButton?.click());

    expect(onNavigateStart).toHaveBeenCalledWith("next-session");
    expect(next).not.toHaveBeenCalled();
    runNextFrame();
    expect(next).not.toHaveBeenCalled();
    runNextFrame();
    expect(next).toHaveBeenCalledWith("current-session");
  });
});
