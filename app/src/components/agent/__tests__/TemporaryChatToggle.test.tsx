import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TemporaryChatToggle } from "../TemporaryChatToggle";

describe("TemporaryChatToggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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

  it("offers to turn on temporary chat when off", () => {
    const onToggle = vi.fn();

    act(() => {
      root.render(
        <TemporaryChatToggle isTemporary={false} onToggle={onToggle} />
      );
    });

    const button = container.querySelector(
      'button[aria-label="Turn on temporary chat"]'
    );
    expect(button).not.toBeNull();

    act(() => {
      button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("offers to turn off temporary chat when on", () => {
    act(() => {
      root.render(
        <TemporaryChatToggle isTemporary={true} onToggle={vi.fn()} />
      );
    });

    expect(
      container.querySelector('button[aria-label="Turn off temporary chat"]')
    ).not.toBeNull();
  });
});
