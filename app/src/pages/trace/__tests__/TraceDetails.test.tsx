import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchParams = new URLSearchParams("selectedTraceId=trace-display-id");
let currentPathname = "/projects/project-node-id/traces";
const navigateMock = vi.fn();
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

const relayMock = vi.hoisted(() => {
  let hasParentSession = true;

  return {
    getTrace: () => ({
      id: "trace-node-id",
      traceId: "trace-display-id",
      session: hasParentSession
        ? {
            id: "session-node-id",
            sessionId: "session-display-id",
            tokenUsage: { total: 84 },
            costSummary: { total: { cost: 0.02 } },
          }
        : null,
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
    }),
    setHasParentSession: (value: boolean) => {
      hasParentSession = value;
    },
  };
});

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  useLazyLoadQuery: vi.fn(() => ({
    project: {
      trace: relayMock.getTrace(),
    },
  })),
}));

vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: currentPathname }),
  useNavigate: () => navigateMock,
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
    showMissingParentSession,
    session,
    sessionTurnContext,
    traceSelection,
  }: {
    showMissingParentSession?: boolean;
    session?: {
      isActive?: boolean;
      isSelected: boolean;
      onSelect: () => void;
      sessionId: string;
    };
    sessionTurnContext?: {
      turnsAfter: number;
      turnsBefore: number;
      to: string;
    };
    traceSelection?: {
      isActive?: boolean;
      isSelected: boolean;
      onSelect: () => void;
      traceId: string;
    };
  }) =>
    session || traceSelection ? (
      <>
        {showMissingParentSession ? <div>No parent session</div> : null}
        {session ? (
          <div
            data-testid="session-row"
            data-selected={session.isSelected || undefined}
            data-has-active-descendant={
              (session.isActive && !session.isSelected) || undefined
            }
          >
            <button
              type="button"
              aria-label={`View session ${session.sessionId}`}
              aria-pressed={session.isSelected}
              onClick={session.onSelect}
            >
              Session
            </button>
          </div>
        ) : null}
        {traceSelection ? (
          <div
            data-testid="trace-row"
            data-selected={traceSelection.isSelected || undefined}
            data-has-active-descendant={
              (traceSelection.isActive && !traceSelection.isSelected) ||
              undefined
            }
          >
            <button
              type="button"
              aria-label={`View trace ${traceSelection.traceId}`}
              aria-pressed={traceSelection.isSelected}
              onClick={traceSelection.onSelect}
            >
              Trace
            </button>
          </div>
        ) : null}
        {sessionTurnContext ? (
          <>
            <a href={sessionTurnContext.to}>
              {sessionTurnContext.turnsBefore} turn before
            </a>
            <a href={sessionTurnContext.to}>
              {sessionTurnContext.turnsAfter} turns after
            </a>
          </>
        ) : null}
      </>
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
  SpanDetailsPaintGate: () => (
    <div data-testid="span-details">
      <div data-span-details-sections />
    </div>
  ),
}));

vi.mock("../SpanInfoCardsContext", () => ({
  SpanInfoCardsProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../SessionDetailsTraceList", () => ({
  SessionConversation: ({
    getTraceUrl,
    sessionId,
  }: {
    getTraceUrl?: (trace: {
      sectionId?: string;
      spanNodeId?: string;
      traceId: string;
    }) => string;
    sessionId: string;
  }) => (
    <div
      data-testid="session-conversation"
      data-span-url={getTraceUrl?.({
        sectionId: "span-details-other-span-input",
        spanNodeId: "other-span-node-id",
        traceId: "other-trace-id",
      })}
      data-trace-url={getTraceUrl?.({
        traceId: "other-trace-id",
      })}
    >
      {sessionId}
    </div>
  ),
}));

vi.mock("../TraceDetailsSkeleton", () => ({
  DetailPanelAnnotationBarSkeleton: () => null,
  TraceTreeNavigationSkeleton: () => (
    <div data-testid="trace-tree-navigation-skeleton" />
  ),
}));

vi.mock("../TraceTurnContent", () => ({
  TraceTurnContent: ({
    onMessageDoubleClick,
    rootSpan,
  }: {
    onMessageDoubleClick?: (role: "INPUT" | "OUTPUT") => void;
    rootSpan: { id: string };
  }) => (
    <div data-testid="trace-turn-content">
      {rootSpan.id}
      <button
        type="button"
        aria-label="Open trace input"
        onDoubleClick={() => onMessageDoubleClick?.("INPUT")}
      />
    </div>
  ),
}));

import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import { TraceDetails } from "../TraceDetails";

describe("TraceDetails", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    currentPathname = "/projects/project-node-id/traces";
    relayMock.setHasParentSession(true);
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
    navigateMock.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("lets collapsed trace navigation paint outside its hydration gate", () => {
    act(() => {
      root.render(
        <ThemeProvider>
          <TraceDetails
            traceId="trace-display-id"
            projectId="project-node-id"
            isTreePanelCollapsed
          />
        </ThemeProvider>
      );
    });

    const navigationGate = container.querySelector<HTMLElement>(
      "[data-span-navigation-state]"
    );
    expect(getComputedStyle(navigationGate!).overflow).toBe("visible");
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
    const rootSpanPreview = container.querySelector(
      ".trace-root-span-details__root-span"
    );
    expect(
      rootSpanPreview?.querySelector("[data-testid='span-details']")
    ).not.toBeNull();
    expect(rootSpanPreview?.getAttribute("data-preview")).toBe("true");
    expect(rootSpanPreview?.getAttribute("aria-hidden")).toBe("true");
    expect(rootSpanPreview?.hasAttribute("inert")).toBe(true);
    expect(getComputedStyle(rootSpanPreview!).borderTopWidth).toBe(
      "var(--global-border-size-thin)"
    );
    expect(getComputedStyle(rootSpanPreview!).borderTopStyle).toBe("solid");
    expect(getComputedStyle(rootSpanPreview!).borderTopColor).toBe(
      "var(--global-border-color-default)"
    );

    expect(
      container.querySelector('button[aria-label^="Annotations for"]')
    ).toBeNull();
    expect(
      traceHeader.querySelector("[data-testid='session-annotation-bar']")
    ).toBeNull();
  });

  it("opens trace-level turn input in the already-mounted root span", () => {
    searchParams.set("timeRangeKey", "30d");
    searchParams.set("sessionView", "turns");
    act(() => {
      root.render(
        <ThemeProvider>
          <TraceDetails
            traceId="trace-display-id"
            projectId="project-node-id"
          />
        </ThemeProvider>
      );
    });

    act(() => {
      container
        .querySelector('button[aria-label="Open trace input"]')
        ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });

    expect(navigateMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith({
      pathname: "/projects/project-node-id/traces",
      search:
        "timeRangeKey=30d&sessionView=turns&selectedSpanNodeId=root-span-node-id",
      hash: "#span-details-root-span-id-input",
    });
  });

  it("selects the already-rendered root span when its header reaches the top", () => {
    const renderDetails = () =>
      root.render(
        <ThemeProvider>
          <TraceDetails
            traceId="trace-display-id"
            projectId="project-node-id"
          />
        </ThemeProvider>
      );
    act(renderDetails);

    const scrollContainer = container.querySelector<HTMLDivElement>(
      "[data-trace-root-span-scroll-container]"
    );
    const rootSpanPreview = container.querySelector<HTMLDivElement>(
      ".trace-root-span-details__root-span"
    );
    const spanDetailsBeforeSelection = rootSpanPreview?.querySelector(
      "[data-testid='span-details']"
    );
    vi.spyOn(scrollContainer!, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 100)
    );
    let rootSpanTop = 102;
    vi.spyOn(rootSpanPreview!, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, rootSpanTop)
    );

    act(() => {
      scrollContainer?.dispatchEvent(new Event("scroll"));
    });
    expect(searchParams.get("selectedSpanNodeId")).toBeNull();

    rootSpanTop = 101;

    act(() => {
      scrollContainer?.dispatchEvent(new Event("scroll"));
    });

    expect(searchParams.get("selectedSpanNodeId")).toBe("root-span-node-id");
    expect(searchParams.has("selectedTraceId")).toBe(false);

    act(renderDetails);

    const rootSpanDetails = container.querySelector<HTMLDivElement>(
      ".trace-root-span-details__root-span"
    );
    expect(rootSpanDetails?.getAttribute("data-preview")).toBe("false");
    expect(rootSpanDetails?.hasAttribute("aria-hidden")).toBe(false);
    expect(rootSpanDetails?.hasAttribute("inert")).toBe(false);
    expect(getComputedStyle(rootSpanDetails!).borderTopStyle).toBe("none");
    expect(rootSpanDetails?.querySelector("[data-testid='span-details']")).toBe(
      spanDetailsBeforeSelection
    );
    expect(
      container.querySelector("[data-testid='trace-turn-content']")
    ).toBeNull();
  });

  it("resists upward overscroll before snapping back or selecting the trace", () => {
    vi.useFakeTimers();
    searchParams.delete("selectedTraceId");
    searchParams.set("selectedSpanNodeId", "root-span-node-id");
    let shouldDefaultToTrace = false;
    const renderDetails = () =>
      root.render(
        <ThemeProvider>
          <TraceDetails
            defaultToTrace={shouldDefaultToTrace}
            key={searchParams.toString()}
            traceId="trace-display-id"
            projectId="project-node-id"
          />
        </ThemeProvider>
      );
    act(renderDetails);

    const rootSpanDetails = container.querySelector<HTMLDivElement>(
      ".trace-root-span-details__root-span"
    );
    const spanDetailsSections = container.querySelector<HTMLDivElement>(
      "[data-span-details-sections]"
    );
    const partialPull = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -40,
    });
    act(() => {
      spanDetailsSections?.dispatchEvent(partialPull);
    });
    expect(partialPull.defaultPrevented).toBe(true);
    expect(rootSpanDetails?.style.transform).toBe("translateY(3.33px)");
    expect(searchParams.has("selectedTraceId")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(rootSpanDetails?.style.transform).toBe("");

    spanDetailsSections!.scrollTop = 10;
    const scrollableContentWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -200,
    });
    act(() => {
      spanDetailsSections?.dispatchEvent(scrollableContentWheel);
    });
    expect(scrollableContentWheel.defaultPrevented).toBe(false);
    expect(searchParams.has("selectedTraceId")).toBe(false);

    spanDetailsSections!.scrollTop = 0;
    act(() => {
      spanDetailsSections?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -500,
        })
      );
    });
    expect(rootSpanDetails?.style.transform).toBe("translateY(4.62px)");
    expect(searchParams.has("selectedTraceId")).toBe(false);

    act(() => {
      for (let eventIndex = 0; eventIndex < 2; eventIndex += 1) {
        spanDetailsSections?.dispatchEvent(
          new WheelEvent("wheel", {
            bubbles: true,
            cancelable: true,
            deltaY: -500,
          })
        );
      }
    });
    expect(rootSpanDetails?.style.transform).toBe("translateY(9.47px)");
    expect(searchParams.has("selectedTraceId")).toBe(false);

    act(() => {
      vi.advanceTimersByTime(120);
      spanDetailsSections?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -10,
        })
      );
    });
    expect(rootSpanDetails?.style.transform).toBe("translateY(9.74px)");
    expect(searchParams.has("selectedTraceId")).toBe(false);

    act(() => {
      spanDetailsSections?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -40,
        })
      );
    });
    expect(searchParams.get("selectedTraceId")).toBe("trace-display-id");
    expect(searchParams.has("selectedSpanNodeId")).toBe(false);

    shouldDefaultToTrace = true;
    act(renderDetails);
    const traceRootSpanDetails = container.querySelector<HTMLDivElement>(
      "[data-trace-root-span-scroll-container]"
    );
    expect(traceRootSpanDetails?.scrollTop).toBe(0);
    expect(
      container.querySelector("[data-testid='trace-turn-content']")
    ).not.toBeNull();
  });

  it("keeps the parent trace active while a span is selected", () => {
    searchParams.delete("selectedTraceId");
    searchParams.set("selectedSpanNodeId", "root-span-node-id");

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
      container
        .querySelector('button[aria-label="View trace trace-display-id"]')
        ?.getAttribute("aria-pressed")
    ).toBe("false");
    expect(
      container
        .querySelector("[data-testid='trace-row']")
        ?.getAttribute("data-selected")
    ).toBeNull();
    expect(
      container
        .querySelector("[data-testid='trace-row']")
        ?.getAttribute("data-has-active-descendant")
    ).toBe("true");
    expect(
      container
        .querySelector("[data-testid='session-row']")
        ?.getAttribute("data-has-active-descendant")
    ).toBe("true");
    expect(
      container.querySelector("[data-testid='span-details']")
    ).not.toBeNull();

    act(() => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="View trace trace-display-id"]'
        )
        ?.click();
    });
    expect(searchParams.get("selectedTraceId")).toBe("trace-display-id");
    expect(searchParams.has("selectedSpanNodeId")).toBe(false);
  });

  it.each(["traces", "spans"] as const)(
    "keeps session turn drill-ins in the %s panel",
    (projectSurface) => {
      currentPathname = `/projects/project-node-id/${projectSurface}`;
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
      ).toBe(`/projects/project-node-id/${projectSurface}/other-trace-id`);
      expect(
        container
          .querySelector("[data-testid='session-conversation']")
          ?.getAttribute("data-span-url")
      ).toBe(
        `/projects/project-node-id/${projectSurface}/other-trace-id?selectedSpanNodeId=other-span-node-id#span-details-other-span-input`
      );
      expect(
        container.querySelector("[data-testid='span-details']")
      ).toBeNull();
      expect(
        container.querySelector("[data-testid='trace-turn-content']")
      ).toBeNull();
    }
  );

  it("omits surrounding turns until session trace indexing is available", () => {
    searchParams.delete("selectedTraceId");
    searchParams.set("selectedSpanNodeId", "root-span-node-id");
    searchParams.set("timeRangeKey", "30d");

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

    expect(container.textContent).not.toContain("turn before");
    expect(container.textContent).not.toContain("turn after");
  });

  it("shows when the trace has no parent session", () => {
    relayMock.setHasParentSession(false);

    act(() => {
      root.render(
        <ThemeProvider>
          <TraceDetails
            traceId="trace-display-id"
            projectId="project-node-id"
          />
        </ThemeProvider>
      );
    });

    expect(container.textContent).toContain("No parent session");
    expect(container.textContent).not.toContain("Session");
    expect(container.textContent).not.toContain("turn before");
    expect(container.textContent).not.toContain("turn after");
  });
});
