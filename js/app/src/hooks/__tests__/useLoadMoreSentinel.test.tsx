import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLoadMoreSentinel } from "../useLoadMoreSentinel";

type ObserverRecord = {
  callback: IntersectionObserverCallback;
  target: Element | null;
  isDisconnected: boolean;
};

const observers: ObserverRecord[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds = [];
  readonly #record: ObserverRecord;

  constructor(callback: IntersectionObserverCallback) {
    this.#record = { callback, target: null, isDisconnected: false };
    observers.push(this.#record);
  }

  observe(target: Element) {
    this.#record.target = target;
  }

  unobserve() {}

  disconnect() {
    this.#record.isDisconnected = true;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function liveObservers() {
  return observers.filter((record) => !record.isDisconnected);
}

function reportIntersection(isIntersecting: boolean) {
  const live = liveObservers();
  expect(live).toHaveLength(1);
  const [record] = live;
  act(() => {
    record.callback(
      [{ isIntersecting, target: record.target } as IntersectionObserverEntry],
      record as unknown as IntersectionObserver
    );
  });
}

type LoadNext = Parameters<typeof useLoadMoreSentinel>[0]["loadNext"];

type SentinelProps = {
  hasNext?: boolean;
  isLoadingNext?: boolean;
  loadNext: LoadNext;
  rows: ReadonlyArray<unknown>;
};

function Sentinel({
  hasNext = true,
  isLoadingNext = false,
  loadNext,
  rows,
}: SentinelProps) {
  const ref = useLoadMoreSentinel<HTMLDivElement>({
    hasNext,
    isLoadingNext,
    loadNext,
    pageSize: 10,
    rows,
  });
  return <div ref={ref} />;
}

const defaultIntersectionObserver = globalThis.IntersectionObserver;

describe("useLoadMoreSentinel", () => {
  let container: HTMLDivElement;
  let root: Root;
  const render = (props: SentinelProps) =>
    act(() => root.render(<Sentinel {...props} />));

  beforeEach(() => {
    observers.length = 0;
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    globalThis.IntersectionObserver = defaultIntersectionObserver;
  });

  it("loads the next page while the sentinel is in view", () => {
    const loadNext = vi.fn();
    render({ loadNext, rows: [1] });
    reportIntersection(true);
    expect(loadNext).toHaveBeenCalledTimes(1);
    expect(loadNext).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ onComplete: expect.any(Function) })
    );
  });

  it("does not observe while a page is loading or nothing is left", () => {
    const loadNext = vi.fn();
    const rows = [1];
    render({ loadNext, rows });
    expect(liveObservers()).toHaveLength(1);
    render({ loadNext, rows, isLoadingNext: true });
    expect(liveObservers()).toHaveLength(0);
    render({ loadNext, rows, hasNext: false });
    expect(liveObservers()).toHaveLength(0);
  });

  it("keeps loading after a page settles while still in view", () => {
    const loadNext = vi.fn();
    render({ loadNext, rows: [1] });
    reportIntersection(true);
    render({ loadNext, rows: [1], isLoadingNext: true });
    render({ loadNext, rows: [1, 2] });
    reportIntersection(true);
    expect(loadNext).toHaveBeenCalledTimes(2);
  });

  it("waits for the sentinel to leave and return after a failed page", () => {
    const loadNext = vi.fn<LoadNext>((_count, options) => {
      options?.onComplete?.(new Error("page failed"));
    });
    const rows = [1];
    render({ loadNext, rows });
    reportIntersection(true);
    expect(loadNext).toHaveBeenCalledTimes(1);
    render({ loadNext, rows, isLoadingNext: true });
    render({ loadNext, rows });
    reportIntersection(true);
    expect(loadNext).toHaveBeenCalledTimes(1);
    reportIntersection(false);
    reportIntersection(true);
    expect(loadNext).toHaveBeenCalledTimes(2);
  });
});
