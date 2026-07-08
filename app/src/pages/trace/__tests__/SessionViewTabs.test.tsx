import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionViewTabs } from "../SessionViewTabs";

describe("SessionViewTabs", () => {
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

  it("emits a view change when a different tab is clicked", () => {
    const onSessionViewChange = vi.fn();

    act(() => {
      root.render(
        <SessionViewTabs
          sessionView="turns"
          onSessionViewChange={onSessionViewChange}
          traceCount={12}
        >
          <div>Session content</div>
        </SessionViewTabs>
      );
    });

    const tracesTab = container.querySelectorAll('[role="tab"]')[1];
    expect(tracesTab).toBeInstanceOf(HTMLElement);

    act(() => {
      tracesTab?.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
        })
      );
    });

    expect(onSessionViewChange).toHaveBeenCalledWith("traces");
  });
});
