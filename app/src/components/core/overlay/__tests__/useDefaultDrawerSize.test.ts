import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDefaultDrawerSize } from "../useDefaultDrawerSize";

const DRAWER_STORAGE_KEY = "arize-phoenix-drawer-trace-details-size";
const PERSIST_DEBOUNCE_MS = 250;

function TestComponent({
  storage,
  onRender,
}: {
  storage: Storage;
  onRender: (result: ReturnType<typeof useDefaultDrawerSize>) => void;
}) {
  const result = useDefaultDrawerSize({
    id: "trace-details",
    storage,
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
});
