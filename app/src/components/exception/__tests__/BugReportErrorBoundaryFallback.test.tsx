import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BugReportErrorBoundaryFallback } from "../BugReportErrorBoundaryFallback";

describe("BugReportErrorBoundaryFallback", () => {
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
  });

  it("contains timeout details within a bounded parent", () => {
    act(() => {
      root.render(
        <BugReportErrorBoundaryFallback error="504 Gateway Timeout" />
      );
    });

    const fallback = container.querySelector<HTMLElement>(
      '[data-testid="connection-timeout-fallback"]'
    );
    expect(fallback).not.toBeNull();

    const style = getComputedStyle(fallback!);
    expect(style.boxSizing).toBe("border-box");
    expect(style.width).toBe("100%");
    expect(style.maxWidth).toBe("100%");
    expect(style.minWidth).toBe("0px");
    expect(style.height).toBe("100%");
    expect(style.maxHeight).toBe("100%");
    expect(style.overflow).toBe("auto");
  });
});
