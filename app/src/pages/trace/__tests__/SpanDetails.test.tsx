import type { ReactNode } from "react";
import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import type * as ReactRouter from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const pendingContent = new Promise<never>(() => undefined);

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  useFragment: vi.fn((_fragment, data) => data),
  useLazyLoadQuery: vi.fn(
    (_query, variables: { id: string; includeSession?: boolean }) => {
      if (variables.includeSession === undefined) {
        throw pendingContent;
      }
      return {
        span: {
          __typename: "Span",
          id: "span-node-id",
          spanId: "span-display-id",
          spanKind: "llm",
          name: "selected span",
          code: "OK",
          statusMessage: "",
          latencyMs: 125,
          startTime: "2026-07-28T12:00:00.000Z",
          tokenCountTotal: 42,
          costSummary: { total: { cost: 0.01 } },
          trace: {
            id: "trace-node-id",
            traceId: "trace-display-id",
            latencyMs: 250,
            startTime: "2026-07-28T11:59:59.000Z",
            costSummary: { total: { cost: 0.02 } },
            rootSpan: {
              statusCode: "OK",
              cumulativeTokenCountTotal: 84,
            },
            session: variables.includeSession
              ? {
                  id: "session-node-id",
                  sessionId: "session-display-id",
                  tokenUsage: { total: 168 },
                  costSummary: { total: { cost: 0.04 } },
                }
              : undefined,
          },
        },
      };
    }
  ),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return { ...actual, useParams: () => ({ projectId: "project-id" }) };
});

vi.mock(
  "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar",
  () => ({
    SessionDetailPanelAnnotationBar: () => (
      <div data-testid="session-annotations" />
    ),
    TraceDetailPanelAnnotationBar: () => (
      <div data-testid="trace-annotations" />
    ),
    SpanDetailPanelAnnotationBar: () => <div data-testid="span-annotations" />,
    useSpanDetailPanelAnnotationBarQuery: () => ({
      queryRef: {},
      refresh: vi.fn(),
    }),
  })
);

vi.mock("../SpanDetailsHeaderActions", () => ({
  SpanDetailsHeaderActions: () => null,
}));

import { SpanDetails } from "../SpanDetails";
import { SpanInfoCardsProvider } from "../SpanInfoCardsContext";

function TestProviders({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <PreferencesProvider>
          <SpanInfoCardsProvider>
            <Suspense fallback={null}>{children}</Suspense>
          </SpanInfoCardsProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("SpanDetails headers", () => {
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

  it("renders session, trace, and span as separate annotated headers", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const headers = container.querySelectorAll("[data-detail-header]");
    expect(headers).toHaveLength(3);
    expect(headers.item(0).textContent).toContain("Session");
    expect(
      headers.item(0).querySelector("[data-testid='session-annotations']")
    ).not.toBeNull();
    expect(
      headers.item(0).querySelector("[data-testid='trace-annotations']")
    ).toBeNull();
    expect(headers.item(1).textContent).toContain("Trace");
    expect(
      headers.item(1).querySelector("[data-testid='trace-annotations']")
    ).not.toBeNull();
    expect(
      headers.item(1).querySelector("[data-testid='span-annotations']")
    ).toBeNull();
    expect(headers.item(2).textContent).toContain("selected span");
    expect(
      headers.item(2).querySelector("[data-testid='span-annotations']")
    ).not.toBeNull();
  });

  it("omits the session header when an enclosing session panel owns it", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" showSessionHeader={false} />
        </TestProviders>
      );
    });

    const headers = container.querySelectorAll("[data-detail-header]");
    expect(headers).toHaveLength(2);
    expect(headers.item(0).textContent).toContain("Trace");
    expect(headers.item(1).textContent).toContain("selected span");
  });
});
