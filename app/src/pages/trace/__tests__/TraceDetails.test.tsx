import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams("selectedTraceId=trace-display-id");
const setSearchParams = vi.fn(
  (
    update:
      | URLSearchParams
      | ((currentSearchParams: URLSearchParams) => URLSearchParams)
  ) => {
    if (typeof update === "function") {
      update(searchParams);
    }
  }
);

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
  useLocation: () => ({ pathname: "/projects/project-node-id/traces" }),
  useParams: () => ({ projectId: "project-node-id" }),
  useSearchParams: () => [searchParams, setSearchParams],
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
  ConnectedTraceTree: ({
    session,
  }: {
    session?: {
      isSelected: boolean;
      onSelect: () => void;
      sessionId: string;
    };
  }) =>
    session ? (
      <button
        type="button"
        aria-label={`View session ${session.sessionId}`}
        aria-pressed={session.isSelected}
        onClick={session.onSelect}
      >
        Session
      </button>
    ) : null,
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

vi.mock("../SessionDetailsTraceList", () => ({
  SessionConversation: ({
    getTraceUrl,
    sessionId,
  }: {
    getTraceUrl?: (trace: { traceId: string; spanNodeId: string }) => string;
    sessionId: string;
  }) => (
    <div
      data-testid="session-conversation"
      data-trace-url={getTraceUrl?.({
        traceId: "other-trace-id",
        spanNodeId: "other-span-node-id",
      })}
    >
      {sessionId}
    </div>
  ),
}));

vi.mock("../TraceDetailsSkeleton", () => ({
  DetailPanelAnnotationBarSkeleton: () => null,
}));

vi.mock("../TraceTurnContent", () => ({
  TraceTurnContent: ({ rootSpan }: { rootSpan: { id: string } }) => (
    <div data-testid="trace-turn-content">{rootSpan.id}</div>
  ),
}));

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceDetails } from "../TraceDetails";

describe("TraceDetails", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    });
    searchParams.forEach((_, key) => searchParams.delete(key));
    searchParams.set("selectedTraceId", "trace-display-id");
    setSearchParams.mockClear();
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
        <ThemeProvider>
          <TraceDetails
            key={searchParams.toString()}
            traceId="trace-display-id"
            projectId="project-node-id"
          />
        </ThemeProvider>
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
    const traceTurnContent = container.querySelector(
      "[data-testid='trace-turn-content']"
    );
    expect(traceTurnContent?.textContent).toBe("root-span-node-id");
    expect(traceTurnContent?.parentElement?.style.padding).toBe(
      "var(--global-grid-margin-xsmall)"
    );
    expect(container.querySelector("[data-testid='span-details']")).toBeNull();

    expect(
      container.querySelector('button[aria-label^="Annotations for"]')
    ).toBeNull();
    expect(
      traceHeader.querySelector("[data-testid='session-annotation-bar']")
    ).toBeNull();
  });

  it("selects the session in place and shows its header and conversation", () => {
    const renderDetails = () =>
      root.render(
        <ThemeProvider>
          <TraceDetails
            key={searchParams.toString()}
            traceId="trace-display-id"
            projectId="project-node-id"
          />
        </ThemeProvider>
      );
    act(renderDetails);

    const sessionButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="View session session-display-id"]'
    );
    expect(sessionButton?.getAttribute("aria-pressed")).toBe("false");

    act(() => sessionButton?.click());
    expect(searchParams.get("selectedSessionNodeId")).toBe("session-node-id");
    expect(searchParams.has("selectedTraceId")).toBe(false);

    act(renderDetails);

    expect(
      container
        .querySelector('button[aria-label="View session session-display-id"]')
        ?.getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      container.querySelector("[data-testid='session-annotation-bar']")
        ?.textContent
    ).toBe("session-node-id");
    expect(
      container.querySelector("[data-testid='session-conversation']")
        ?.textContent
    ).toBe("session-node-id");
    expect(
      container
        .querySelector("[data-testid='session-conversation']")
        ?.getAttribute("data-trace-url")
    ).toBe(
      "/projects/project-node-id/traces/other-trace-id?selectedSpanNodeId=other-span-node-id"
    );
    expect(container.querySelector("[data-testid='span-details']")).toBeNull();
    expect(
      container.querySelector("[data-testid='trace-turn-content']")
    ).toBeNull();
  });
});
