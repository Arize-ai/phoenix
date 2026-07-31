import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  TraceDetailsHeader,
  TraceDetailsHeaderSkeleton,
} from "../TraceDetailsHeader";

describe("TraceDetailsHeader", () => {
  installTestMatchMedia();

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

  it.each([
    ["loaded", <TraceDetailsHeader key="loaded" trace={createTrace()} />],
    ["loading", <TraceDetailsHeaderSkeleton key="loading" />],
  ])("shows the neutral trace identity in the %s header", (_state, header) => {
    act(() => {
      root.render(
        <ThemeProvider>
          <PreferencesProvider>{header}</PreferencesProvider>
        </ThemeProvider>
      );
    });

    const statusIndicator = container.querySelector(
      ".detail-header-status-indicator"
    );
    expect(statusIndicator?.getAttribute("aria-hidden")).toBe("true");
    expect(statusIndicator?.getAttribute("style")).toContain(
      "--detail-header-status-indicator-color: var(--global-color-gray-200)"
    );

    const firstMetaItem = container.querySelector(".detail-header__meta-item");
    expect(firstMetaItem?.textContent).toBe("trace");
    const traceIcon = firstMetaItem?.querySelector('[data-core-icon="true"]');
    expect(traceIcon).not.toBeNull();
    expect(traceIcon?.getAttribute("style")).toContain(
      "--span-kind-icon-color: var(--global-color-gray-100)"
    );

    const identityRow = container.querySelector<HTMLElement>(
      ".detail-header__identity"
    );
    expect(getComputedStyle(identityRow!).height).toBe(
      "var(--global-dimension-size-400)"
    );
    expect(getComputedStyle(identityRow!).alignItems).toBe("center");
  });
});

function createTrace() {
  return {
    id: "trace-node-id",
    latencyMs: 100,
    startTime: "2026-07-30T12:00:00.000Z",
    tokenCountTotal: 0,
    totalCost: 0,
    traceId: "trace-id",
  };
}
