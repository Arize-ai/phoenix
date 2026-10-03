import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentContext } from "@phoenix/contexts/AgentContext";
import { type AgentStore, createAgentStore } from "@phoenix/store/agentStore";

import {
  DEFAULT_GAP_GRACE_MS,
  DEFAULT_LONG_RUN_THRESHOLD_MS,
  DEFAULT_MINIMUM_VISIBLE_MS,
  usePxiFrameBorderState,
} from "../usePxiFrameBorderState";

describe("usePxiFrameBorderState", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: AgentStore;

  function Probe() {
    return <span data-state={usePxiFrameBorderState()} />;
  }

  function readState() {
    return container.querySelector("span")?.dataset.state;
  }

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    store = createAgentStore();
    act(() => {
      root.render(
        <AgentContext.Provider value={store}>
          <Probe />
        </AgentContext.Provider>
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  function startRun() {
    act(() => {
      store
        .getState()
        .startBrowserActionRun({ toolCallId: "run-1", sessionId: "s-1" });
    });
  }

  function endRun() {
    act(() => {
      store.getState().endBrowserActionRun("run-1");
    });
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it("moves idle → quick → long → idle across a long run", () => {
    expect(readState()).toBe("idle");
    startRun();
    expect(readState()).toBe("quick");
    advance(DEFAULT_LONG_RUN_THRESHOLD_MS);
    expect(readState()).toBe("long");
    endRun();
    advance(DEFAULT_GAP_GRACE_MS - 1);
    expect(readState()).toBe("long");
    advance(1);
    expect(readState()).toBe("idle");
  });

  it("holds a sub-second run as quick for the minimum dwell, then idles", () => {
    startRun();
    advance(30);
    endRun();
    advance(DEFAULT_MINIMUM_VISIBLE_MS - 31);
    expect(readState()).toBe("quick");
    advance(1);
    expect(readState()).toBe("idle");
  });
});
