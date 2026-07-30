import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams("selectedTraceId=trace-display-id");

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  useLazyLoadQuery: vi.fn(() => ({
    project: {
      trace: {
        id: "trace-node-id",
        traceId: "trace-display-id",
        session: {
          id: "session-node-id",
          sessionId: "session-display-id",
          tokenUsage: { total: 84 },
          costSummary: { total: { cost: 0.02 } },
        },
        rootSpans: {
          edges: [
            {
              span: {
                id: "root-span-node-id",
                spanId: "root-span-id",
                parentId: null,
                statusCode: "OK",
                latencyMs: 125,
                startTime: "2026-07-28T12:00:00.000Z",
                cumulativeTokenCountTotal: 42,
                trace: {
                  costSummary: { total: { cost: 0.01 } },
                },
              },
            },
          ],
        },
      },
    },
  })),
}));

vi.mock("react-router", () => ({
  useSearchParams: () => [searchParams, vi.fn()],
}));

vi.mock(
  "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar",
  () => ({
    SessionDetailPanelAnnotationButton: () => null,
    SessionDetailPanelAnnotationBar: ({
      sessionNodeId,
    }: {
      sessionNodeId: string;
    }) => <div data-testid="session-annotation-bar">{sessionNodeId}</div>,
    SpanDetailPanelAnnotationButton: () => null,
    TraceDetailPanelAnnotationButton: () => null,
    TraceDetailPanelAnnotationBar: ({
      traceNodeId,
    }: {
      traceNodeId: string;
    }) => <div data-testid="trace-annotation-bar">{traceNodeId}</div>,
  })
);

vi.mock("@phoenix/components/trace/TraceTree", () => ({
  TraceTreeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@phoenix/components/trace/TraceTreeToolbar", () => ({
  TraceTreeToolbar: () => null,
}));

vi.mock("@phoenix/contexts/PreferencesContext", () => ({
  usePreferencesContext: (
    selector: (state: { showMetricsInTraceTree: boolean }) => unknown
  ) => selector({ showMetricsInTraceTree: false }),
}));

vi.mock("../ConnectedTraceTree", () => ({
  ConnectedTraceTree: () => null,
}));

vi.mock("../DetailsPanel", () => ({
  DetailsPanelContent: ({
    children,
    navigation,
  }: {
    children: ReactNode;
    navigation: ReactNode;
  }) => (
    <>
      {navigation}
      {children}
    </>
  ),
}));

vi.mock("../SpanDetailsPaintGate", () => ({
  SpanDetailsPaintGate: () => <div data-testid="span-details" />,
}));

vi.mock("../SpanInfoCardsContext", () => ({
  SpanInfoCardsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../TraceDetailsSkeleton", () => ({
  DetailPanelAnnotationBarSkeleton: () => null,
}));

vi.mock("../TraceTurnContent", () => ({
  TraceTurnContent: ({ rootSpan }: { rootSpan: { id: string } }) => (
    <div data-testid="trace-turn-content">{rootSpan.id}</div>
  ),
}));

import { TraceDetails } from "../TraceDetails";

describe("TraceDetails", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows annotations for the selected trace without a scope selector", () => {
    act(() => {
      root.render(
        <TraceDetails traceId="trace-display-id" projectId="project-node-id" />
      );
    });

    expect(
      container.querySelector("[data-testid='trace-annotation-bar']")
        ?.textContent
    ).toBe("trace-node-id");
    const detailHeaders = container.querySelectorAll("[data-detail-header]");
    const traceHeader = detailHeaders.item(0);
    expect(detailHeaders).toHaveLength(1);
    expect(
      traceHeader.querySelector("[data-testid='trace-annotation-bar']")
        ?.textContent
    ).toBe("trace-node-id");
    expect(
      traceHeader.querySelector('[aria-label="Copy Trace ID trace-display-id"]')
    ).not.toBeNull();
    expect(
      traceHeader.querySelector('[aria-label^="Span status:"]')
    ).toBeNull();
    expect(traceHeader.textContent).not.toContain("trace-display-id");
    expect(
      container.querySelector("[data-testid='trace-turn-content']")?.textContent
    ).toBe("root-span-node-id");
    expect(container.querySelector("[data-testid='span-details']")).toBeNull();

    expect(
      container.querySelector('button[aria-label^="Annotations for"]')
    ).toBeNull();
    expect(
      traceHeader.querySelector("[data-testid='session-annotation-bar']")
    ).toBeNull();
  });
});
