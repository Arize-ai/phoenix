import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";

import { useDefaultDrawerSize } from "../useDefaultDrawerSize";

installTestStorage();

const DRAWER_STORAGE_KEY = "arize-phoenix-drawer-trace-details-size";
const PERSIST_DEBOUNCE_MS = 250;

function TestComponent({
  storage,
  onRender,
  defaultSize,
  minimumSize,
  persistenceUnit,
}: {
  storage: Storage;
  onRender: (result: ReturnType<typeof useDefaultDrawerSize>) => void;
  defaultSize?: number;
  minimumSize?: number;
  persistenceUnit?: "percentage" | "pixels";
}) {
  const result = useDefaultDrawerSize({
    id: "trace-details",
    storage,
    defaultSize,
    minimumSize,
    persistenceUnit,
  });
  onRender(result);
  return null;
}

describe("useDefaultDrawerSize", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reads the persisted size from the drawer storage key", () => {
    const storage = window.localStorage;
    const onRender = vi.fn();

    storage.clear();
    storage.setItem(DRAWER_STORAGE_KEY, "42");

    act(() => {
      root.render(createElement(TestComponent, { storage, onRender }));
    });

    expect(onRender).toHaveBeenLastCalledWith({
      defaultSize: "42%",
      onSizeChange: expect.any(Function),
      onSizeChangeEnd: expect.any(Function),
    });
  });

  it("debounces rapid onSizeChange calls into a single storage write", async () => {
    const storage = window.localStorage;
    storage.clear();
    const onRender = vi.fn();

    act(() => {
      root.render(createElement(TestComponent, { storage, onRender }));
    });

    const { onSizeChange } = onRender.mock.calls.at(-1)![0] as ReturnType<
      typeof useDefaultDrawerSize
    >;

    onSizeChange(40);
    onSizeChange(50);
    onSizeChange(60);

    // Prior to the debounce firing, nothing should have been written — if
    // every call wrote synchronously this would already be "60".
    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBeNull();

    // Wait past the debounce window, then assert only the last value landed.
    await new Promise((resolve) =>
      setTimeout(resolve, PERSIST_DEBOUNCE_MS + 50)
    );

    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBe("60");
  });

  it("commits the released size before an immediate reopen", () => {
    vi.useFakeTimers();
    const storage = window.localStorage;
    storage.clear();
    const onRender = vi.fn();

    act(() => {
      root.render(
        createElement(TestComponent, {
          key: "initial",
          storage,
          onRender,
        })
      );
    });

    const initialResult = onRender.mock.calls.at(-1)![0] as ReturnType<
      typeof useDefaultDrawerSize
    >;
    initialResult.onSizeChange(60);
    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBeNull();

    initialResult.onSizeChangeEnd(60);
    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBe("60");

    onRender.mockClear();
    act(() => {
      root.render(
        createElement(TestComponent, {
          key: "reopened",
          storage,
          onRender,
        })
      );
    });

    expect(onRender).toHaveBeenLastCalledWith({
      defaultSize: "60%",
      onSizeChange: expect.any(Function),
      onSizeChangeEnd: expect.any(Function),
    });

    act(() => {
      vi.runAllTimers();
    });
    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBe("60");
  });

  it("uses and persists pixel widths for content-derived drawers", async () => {
    const storage = window.localStorage;
    storage.clear();
    const onRender = vi.fn();

    act(() => {
      root.render(
        createElement(TestComponent, {
          storage,
          onRender,
          defaultSize: 1329,
          persistenceUnit: "pixels",
        })
      );
    });

    const result = onRender.mock.calls.at(-1)![0] as ReturnType<
      typeof useDefaultDrawerSize
    >;
    expect(result.defaultSize).toBe(1329);

    result.onSizeChange(75, 1500);
    await new Promise((resolve) =>
      setTimeout(resolve, PERSIST_DEBOUNCE_MS + 50)
    );
    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBe("1500");
  });

  it("restores a persisted pixel width", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(DRAWER_STORAGE_KEY, "1500");
    const onRender = vi.fn();

    act(() => {
      root.render(
        createElement(TestComponent, {
          storage,
          onRender,
          defaultSize: 1329,
          persistenceUnit: "pixels",
        })
      );
    });

    expect(onRender.mock.calls.at(-1)![0]).toEqual({
      defaultSize: 1500,
      onSizeChange: expect.any(Function),
      onSizeChangeEnd: expect.any(Function),
    });
  });

  it("clamps a finite persisted pixel width without rewriting storage", () => {
    const storage = window.localStorage;
    storage.clear();
    storage.setItem(DRAWER_STORAGE_KEY, "-1");
    const onRender = vi.fn();

    act(() => {
      root.render(
        createElement(TestComponent, {
          storage,
          onRender,
          defaultSize: 960,
          minimumSize: 640,
          persistenceUnit: "pixels",
        })
      );
    });

    expect(onRender.mock.calls.at(-1)![0]).toEqual({
      defaultSize: 640,
      onSizeChange: expect.any(Function),
      onSizeChangeEnd: expect.any(Function),
    });
    expect(storage.getItem(DRAWER_STORAGE_KEY)).toBe("-1");
  });
});
