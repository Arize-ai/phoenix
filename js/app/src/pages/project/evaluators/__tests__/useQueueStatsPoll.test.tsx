import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQueueStatsPoll } from "../evaluationQueueStatParts";

function QueueStatsFetchKey({ isPolling }: { isPolling: boolean }) {
  const { fetchKey } = useQueueStatsPoll({ refreshKey: "refresh", isPolling });
  return <output>{fetchKey}</output>;
}

function ChartFetchKey() {
  const { throttledFetchKey } = useQueueStatsPoll({ refreshKey: "refresh" });
  return <output>{throttledFetchKey}</output>;
}

function setPageVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useQueueStatsPoll", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPageVisibility("visible");
    vi.useRealTimers();
  });

  it("stops polling while the page is hidden and polls once when it is shown", () => {
    act(() => root.render(<QueueStatsFetchKey isPolling />));
    act(() => setPageVisibility("hidden"));

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(container.textContent).toBe("refresh:0");

    act(() => setPageVisibility("visible"));

    expect(container.textContent).toBe("refresh:1");
  });

  it("does not poll on a page opened hidden until it is shown", () => {
    setPageVisibility("hidden");
    act(() => root.render(<QueueStatsFetchKey isPolling />));

    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(container.textContent).toBe("refresh:0");

    act(() => setPageVisibility("visible"));

    expect(container.textContent).toBe("refresh:1");
  });

  it("moves the charts' key once a minute while polling", () => {
    act(() => root.render(<ChartFetchKey />));
    const chartKeys = [0, 1, 2, 3, 4].map(() => {
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      return container.textContent;
    });

    expect(chartKeys).toEqual([
      "refresh:0",
      "refresh:1",
      "refresh:1",
      "refresh:2",
      "refresh:2",
    ]);
  });

  it("moves the charts' key when the page is shown again after a long pause", () => {
    act(() => root.render(<ChartFetchKey />));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    act(() => setPageVisibility("hidden"));
    act(() => {
      vi.advanceTimersByTime(60 * 60_000);
    });
    act(() => setPageVisibility("visible"));

    expect(container.textContent).toBe("refresh:2");
  });

  it("does not poll when the page is shown again while polling is off", () => {
    act(() => root.render(<QueueStatsFetchKey isPolling={false} />));
    act(() => setPageVisibility("hidden"));
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    act(() => setPageVisibility("visible"));

    expect(container.textContent).toBe("refresh:0");
  });
});
