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
        session: null,
        rootSpans: {
          edges: [
            {
              span: {
                id: "root-span-node-id",
                spanId: "root-span-id",
                parentId: null,
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
  DetailsPanel: ({
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

  it("renders the root span turn content when the trace row is selected", () => {
    act(() => {
      root.render(
        <TraceDetails
          traceId="trace-display-id"
          projectId="project-node-id"
          preferredTreeWidth={320}
          onPreferredTreeWidthChange={() => {}}
        />
      );
    });

    expect(
      container.querySelector("[data-testid='trace-annotation-bar']")
        ?.textContent
    ).toBe("trace-node-id");
    expect(
      container.querySelector("[data-testid='trace-turn-content']")?.textContent
    ).toBe("root-span-node-id");
    expect(container.querySelector("[data-testid='span-details']")).toBeNull();
  });
});
