import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { SpanStatusIndicator } from "../../SpanHeader";
import {
  DetailPanelAnnotationBarSkeleton,
  SpanHeaderSkeleton,
  TraceTreeNavigationSkeleton,
} from "../TraceDetailsSkeleton";

describe("Trace details skeletons", () => {
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

  it("keeps the real trace-tree search field mounted while trace data loads", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <TraceTreeNavigationSkeleton isTreePanelCollapsed={false} />
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const search = container.querySelector<HTMLInputElement>(
      'input[aria-label="Search trace tree"]'
    );
    expect(search).not.toBeNull();
    expect(
      container.querySelector(".trace-tree-toolbar__search .skeleton")
    ).toBeNull();
  });

  it("matches metadata and annotation skeletons to loaded control heights", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <SpanHeaderSkeleton />
              <DetailPanelAnnotationBarSkeleton variant="detail-header" />
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    const metadataSkeletons = container.querySelectorAll(
      ".span-header__meta .skeleton"
    );
    expect(metadataSkeletons).toHaveLength(4);
    metadataSkeletons.forEach((skeleton) => {
      expect(getComputedStyle(skeleton).height).toBe("20px");
    });

    const annotationSkeletons = container.querySelectorAll(
      '[data-variant="detail-header"] > .skeleton'
    );
    expect(annotationSkeletons).toHaveLength(3);
    annotationSkeletons.forEach((skeleton) => {
      expect(getComputedStyle(skeleton).height).toBe("30px");
    });
  });

  it("renders every available tree field while detail-only fields load", () => {
    act(() => {
      root.render(
        <MemoryRouter>
          <ThemeProvider>
            <PreferencesProvider>
              <SpanHeaderSkeleton
                spanPreview={{
                  id: "span-node-id",
                  latencyMs: 125,
                  name: "retrieval span",
                  projectId: "project-id",
                  spanId: "span-id",
                  spanKind: "retriever",
                  startTime: "2026-07-28T12:00:00.000Z",
                  statusCode: "ERROR",
                  tokenCountTotal: 456,
                  traceId: "trace-id",
                }}
              />
            </PreferencesProvider>
          </ThemeProvider>
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain("retriever");
    expect(container.textContent).toContain("retrieval span");
    expect(
      container.querySelector('[aria-label="Span status: ERROR"]')
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Error");
    expect(
      container.querySelector('[aria-label="Copy Span ID span-id"]')
    ).not.toBeNull();
    expect(container.textContent).not.toContain("span-id");
    expect(container.textContent).toContain("125");
    expect(container.textContent).toContain("456");
    const metadataRow = container.querySelector(".span-header__meta");
    expect(metadataRow?.firstElementChild?.textContent).toContain("retriever");
    expect(metadataRow?.children[1]?.textContent).toContain("125");
    expect(
      container.querySelector('button[aria-label="Copy Span ID span-id"]')
    ).not.toBeNull();
    expect(container.querySelectorAll(".skeleton")).toHaveLength(0);
    expect(
      container.querySelector<HTMLElement>('[aria-label="Prompt Playground"]')
        ?.dataset.disabled
    ).toBe("true");
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Add to Dataset"]'
      )?.disabled
    ).toBe(false);
    expect(
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Download span"]'
      )?.disabled
    ).toBe(false);
  });

  it("replaces short and long preview names in the shared identity row", () => {
    const renderPreview = (name: string) => {
      act(() => {
        root.render(
          <MemoryRouter>
            <ThemeProvider>
              <PreferencesProvider>
                <SpanHeaderSkeleton
                  spanPreview={{
                    id: "span-node-id",
                    name,
                    spanKind: "chain",
                    statusCode: "OK",
                  }}
                />
              </PreferencesProvider>
            </ThemeProvider>
          </MemoryRouter>
        );
      });
    };

    renderPreview("short");
    const identityRow = container.querySelector(".span-header__identity");
    const shortName = container.querySelector(".span-header__name");
    expect(shortName?.textContent).toBe("short");
    expect(shortName?.previousElementSibling?.getAttribute("aria-label")).toBe(
      "Span status: OK"
    );

    renderPreview("a much longer span name that should truncate when needed");
    const longName = container.querySelector(".span-header__name");
    expect(container.querySelector(".span-header__identity")).toBe(identityRow);
    expect(longName?.textContent).toBe(
      "a much longer span name that should truncate when needed"
    );
    expect(longName?.previousElementSibling?.getAttribute("aria-label")).toBe(
      "Span status: OK"
    );
  });

  it("maps each span status to its semantic indicator color", () => {
    act(() => {
      root.render(
        <>
          <ThemeProvider themeMode="light" disableBodyTheme>
            <div data-testid="light-statuses">
              <SpanStatusIndicator statusCode="OK" />
              <SpanStatusIndicator statusCode="UNSET" />
              <SpanStatusIndicator statusCode="ERROR" />
            </div>
          </ThemeProvider>
          <ThemeProvider themeMode="dark" disableBodyTheme>
            <div data-testid="dark-statuses">
              <SpanStatusIndicator statusCode="OK" />
              <SpanStatusIndicator statusCode="UNSET" />
              <SpanStatusIndicator statusCode="ERROR" />
            </div>
          </ThemeProvider>
        </>
      );
    });

    const expectedLightColors = {
      OK: "green-600",
      UNSET: "gray-500",
      ERROR: "danger",
    } as const;
    const expectedDarkColors = {
      OK: "success",
      UNSET: "gray-500",
      ERROR: "danger",
    } as const;

    for (const [statusCode, color] of Object.entries(expectedLightColors)) {
      expect(
        container
          .querySelector(
            `[data-testid="light-statuses"] [data-status-code="${statusCode}"]`
          )
          ?.getAttribute("style")
      ).toContain(
        `--detail-header-status-indicator-color: var(--global-color-${color})`
      );
    }

    for (const [statusCode, color] of Object.entries(expectedDarkColors)) {
      expect(
        container
          .querySelector(
            `[data-testid="dark-statuses"] [data-status-code="${statusCode}"]`
          )
          ?.getAttribute("style")
      ).toContain(
        `--detail-header-status-indicator-color: var(--global-color-${color})`
      );
    }
  });
});
