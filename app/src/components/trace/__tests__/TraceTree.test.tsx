import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceTree, TraceTreeProvider } from "../TraceTree";
import type { ISpanItem } from "../types";

const ROOT_SPAN: ISpanItem = {
  id: "span-node-id",
  name: "root span",
  spanKind: "chain",
  statusCode: "OK",
  latencyMs: 100,
  startTime: "2026-07-26T12:00:00.000Z",
  endTime: "2026-07-26T12:00:00.100Z",
  parentId: null,
  spanId: "span-id",
};

const CHILD_SPAN: ISpanItem = {
  ...ROOT_SPAN,
  id: "child-span-node-id",
  name: "child span",
  parentId: ROOT_SPAN.spanId,
  spanId: "child-span-id",
};

describe("TraceTree", () => {
  installTestMatchMedia();

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders the session, trace, and root span in order", () => {
    const onTraceSelect = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeProvider>
                <TraceTree
                  spans={[ROOT_SPAN]}
                  session={{
                    sessionId: "session-12345678",
                    to: "/projects/project-1/sessions/session-node-id",
                  }}
                  traceSelection={{
                    isSelected: false,
                    onSelect: onTraceSelect,
                    traceId: "trace-12345678",
                  }}
                  selectedSpanNodeId={ROOT_SPAN.id}
                  scrollSelectedSpanIntoView={false}
                />
              </TraceTreeProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const treeItems = container.querySelectorAll(
      '[data-testid="trace-tree"] > li'
    );
    const sessionLink = treeItems[0]?.querySelector("a");
    const traceButton = treeItems[1]?.querySelector<HTMLButtonElement>(
      'button[aria-label="View trace trace-12345678"]'
    );
    const textContent = container.textContent ?? "";

    expect(treeItems[0]?.textContent).toContain("Sessionsession-12345678");
    expect(sessionLink?.getAttribute("href")).toBe(
      "/projects/project-1/sessions/session-node-id"
    );
    expect(
      treeItems[0]?.querySelector(
        'button[aria-label="Copy Session ID session-12345678"]'
      )
    ).not.toBeNull();
    expect(sessionLink?.querySelector("button")).toBeNull();
    expect(treeItems[1]?.textContent).toContain("Tracetrace-12345678");
    expect(treeItems[1]?.querySelector(".icon-wrap")).not.toBeNull();
    expect(textContent.indexOf("Session")).toBeLessThan(
      textContent.indexOf("Trace")
    );
    expect(textContent.indexOf("Trace")).toBeLessThan(
      textContent.indexOf("root span")
    );

    act(() => traceButton?.click());

    expect(onTraceSelect).toHaveBeenCalledOnce();
  });

  it("renders a selectable trace row before the root span", () => {
    const onTraceSelect = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeProvider>
                <TraceTree
                  spans={[ROOT_SPAN]}
                  traceSelection={{
                    isSelected: true,
                    onSelect: onTraceSelect,
                    traceId: "trace-12345678",
                  }}
                  selectedSpanNodeId=""
                  scrollSelectedSpanIntoView={false}
                />
              </TraceTreeProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const traceButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="View trace trace-12345678"]'
    );
    const traceRow = traceButton?.parentElement;
    const textContent = container.textContent ?? "";

    expect(traceRow?.textContent).toContain("Tracetrace-12345678");
    expect(traceRow?.dataset.selected).toBe("true");
    expect(textContent.indexOf("Trace")).toBeLessThan(
      textContent.indexOf("root span")
    );

    act(() => traceButton?.click());

    expect(onTraceSelect).toHaveBeenCalledOnce();
  });

  it("paints an optimistic span selection before starting navigation", () => {
    const scheduledFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
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
    const onSpanClick = vi.fn();

    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeProvider>
                <TraceTree
                  spans={[ROOT_SPAN, CHILD_SPAN]}
                  selectedSpanNodeId={ROOT_SPAN.id}
                  scrollSelectedSpanIntoView={false}
                  onSpanClick={onSpanClick}
                />
              </TraceTreeProvider>
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const rootSpan = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${ROOT_SPAN.id}"]`
    );
    const childSpan = container.querySelector<HTMLElement>(
      `[data-trace-tree-span-node-id="${CHILD_SPAN.id}"]`
    );
    const rootTrigger = rootSpan?.parentElement;
    const childTrigger = childSpan?.parentElement;
    expect(childTrigger?.getAttribute("role")).toBe("button");

    act(() => childTrigger?.click());
    expect(rootSpan?.dataset.selected).toBe("false");
    expect(childSpan?.dataset.selected).toBe("true");
    expect(onSpanClick).not.toHaveBeenCalled();

    act(() => rootTrigger?.click());
    expect(rootSpan?.dataset.selected).toBe("true");
    expect(childSpan?.dataset.selected).toBe("false");
    expect(scheduledFrames.size).toBe(1);

    const runNextFrame = () => {
      const nextFrame = scheduledFrames.entries().next().value;
      if (!nextFrame) throw new Error("Expected a scheduled animation frame");
      const [frameId, callback] = nextFrame;
      scheduledFrames.delete(frameId);
      act(() => callback(0));
    };
    runNextFrame();
    expect(onSpanClick).not.toHaveBeenCalled();
    runNextFrame();
    expect(onSpanClick).toHaveBeenCalledOnce();
    expect(onSpanClick).toHaveBeenCalledWith(ROOT_SPAN);
  });
});
