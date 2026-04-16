import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDefaultDrawerSize } from "../useDefaultDrawerSize";

const DRAWER_STORAGE_KEY = "arize-phoenix-drawer-trace-details-size";

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
});
