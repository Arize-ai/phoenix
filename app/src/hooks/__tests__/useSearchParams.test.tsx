import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useSearchParams } from "../useSearchParams";

describe("useSearchParams", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderAt(path: string) {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <Probe />
        </MemoryRouter>
      );
    });
  }

  it("keeps the fragment when writing a search param", async () => {
    // React Router's own setter drops it, which is what erases state kept in
    // the fragment whenever an unrelated param is written.
    await renderAt("/spans?timeRangeKey=7d#spanFilterCondition=probe");

    await act(async () => {
      (window as WindowWithProbe).__setTimeRange?.("30d");
    });

    expect(container.textContent).toBe(
      "/spans?timeRangeKey=30d#spanFilterCondition=probe"
    );
  });

  it("keeps the fragment when clearing every search param", async () => {
    await renderAt("/spans?timeRangeKey=7d#spanFilterCondition=probe");

    await act(async () => {
      (window as WindowWithProbe).__clear?.();
    });

    expect(container.textContent).toBe("/spans#spanFilterCondition=probe");
  });

  it("hands the updater a copy, not the live params", async () => {
    // React Router's setter copies, and its docs encourage mutating the
    // argument -- five call sites here do. Passing the live object would let
    // those edits reach other readers before the navigation publishes them.
    await renderAt("/spans?timeRangeKey=7d#spanFilterCondition=probe");

    await act(async () => {
      (window as WindowWithProbe).__mutateInPlace?.();
    });

    // The write still lands...
    expect(container.textContent).toBe("/spans#spanFilterCondition=probe");
    // ...and the object the hook returned was not edited underneath it.
    expect((window as WindowWithProbe).__liveParamsWereMutated).toBe(false);
  });

  it("leaves a location with no fragment alone", async () => {
    await renderAt("/spans?timeRangeKey=7d");

    await act(async () => {
      (window as WindowWithProbe).__setTimeRange?.("30d");
    });

    expect(container.textContent).toBe("/spans?timeRangeKey=30d");
  });
});

type WindowWithProbe = Window &
  typeof globalThis & {
    __setTimeRange?: (value: string) => void;
    __clear?: () => void;
    __mutateInPlace?: () => void;
    __liveParamsWereMutated?: boolean;
  };

function Probe() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname, search, hash } = useLocation();
  (window as WindowWithProbe).__setTimeRange = (value: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("timeRangeKey", value);
        return next;
      },
      { replace: true }
    );
  (window as WindowWithProbe).__clear = () =>
    setSearchParams(new URLSearchParams(), { replace: true });
  (window as WindowWithProbe).__mutateInPlace = () => {
    setSearchParams(
      (prev) => {
        prev.delete("timeRangeKey");
        return prev;
      },
      { replace: true }
    );
    (window as WindowWithProbe).__liveParamsWereMutated =
      !searchParams.has("timeRangeKey");
  };
  return <div>{`${pathname}${search}${hash}`}</div>;
}
