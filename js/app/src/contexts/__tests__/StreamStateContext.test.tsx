import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PreferencesProvider } from "@phoenix/contexts";
import {
  type StreamStateContextType,
  StreamStateProvider,
  useStreamState,
} from "@phoenix/contexts/StreamStateContext";

let container: HTMLDivElement;
let root: Root;
let streamState: StreamStateContextType;

function Probe() {
  const state = useStreamState();
  useEffect(() => {
    streamState = state;
  }, [state]);
  return null;
}

function renderProvider(maxAggregatesAgeMs?: number) {
  act(() => {
    root.render(
      <PreferencesProvider>
        <StreamStateProvider maxAggregatesAgeMs={maxAggregatesAgeMs}>
          <Probe />
        </StreamStateProvider>
      </PreferencesProvider>
    );
  });
}

function advanceTime(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("StreamStateProvider", () => {
  it("moves fetchKey at once and throttledFetchKey to it once per max age", () => {
    renderProvider(10_000);
    for (const fetchKey of ["a", "b", "c"]) {
      advanceTime(2_000);
      act(() => streamState.setFetchKey(fetchKey));
      expect(streamState.fetchKey).toBe(fetchKey);
    }

    expect(streamState.throttledFetchKey).toBe("initial");

    advanceTime(4_000);

    expect(streamState.throttledFetchKey).toBe("c");
    expect(streamState.throttledAt).toBe(Date.now());
  });

  it("leaves throttledFetchKey and its time alone when nothing new arrived", () => {
    renderProvider(10_000);
    const { throttledAt } = streamState;
    advanceTime(30_000);

    expect(streamState.throttledFetchKey).toBe("initial");
    expect(streamState.throttledAt).toBe(throttledAt);
  });
});
