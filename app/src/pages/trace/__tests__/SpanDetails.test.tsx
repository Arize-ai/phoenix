import type { ReactNode } from "react";
import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import type * as ReactRouter from "react-router";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

const pendingContent = new Promise<never>(() => undefined);
const spanDetailsContentTestState = vi.hoisted(() => ({
  events: [] as {
    attributes: Record<string, unknown>;
    message: string;
    name: string;
    timestamp: string;
  }[],
  shouldSuspend: true,
}));
const motionMocks = vi.hoisted(() => ({
  animate: vi.fn(() => ({ cancel: vi.fn(), stop: vi.fn() })),
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("motion/react", () => motionMocks);

vi.mock("react-relay", () => ({
  graphql: vi.fn(),
  useFragment: vi.fn((_fragment, data) => data),
  useLazyLoadQuery: vi.fn((query: { params?: { name?: string } }) => {
    if (query.params?.name === "SpanDetailsContentQuery") {
      if (spanDetailsContentTestState.shouldSuspend) {
        throw pendingContent;
      }
      return {
        span: {
          __typename: "Span",
          id: "span-node-id",
          spanId: "span-display-id",
          spanKind: "chain",
          input: { value: "input", mimeType: "text" },
          output: { value: "output", mimeType: "text" },
          attributes: "{}",
          events: spanDetailsContentTestState.events,
          spanNotes: [],
          documentRetrievalMetrics: [],
          documentEvaluations: [],
        },
      };
    }
    return {
      span: {
        __typename: "Span",
        id: "span-node-id",
        spanId: "span-display-id",
        spanKind: "llm",
        name: "selected span",
        parentId: "parent-span-display-id",
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
          spans: {
            edges: [
              {
                node: {
                  id: "parent-span-node-id",
                  name: "parent span",
                  spanId: "parent-span-display-id",
                  parentId: null,
                },
              },
            ],
          },
          rootSpan: {
            statusCode: "OK",
            cumulativeTokenCountTotal: 84,
          },
        },
      },
    };
  }),
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouter>();
  return { ...actual, useParams: () => ({ projectId: "project-id" }) };
});

vi.mock(
  "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar",
  () => ({
    SessionDetailPanelAnnotationBar: ({
      sessionNodeId,
    }: {
      sessionNodeId: string;
    }) => <div data-testid="session-annotations">{sessionNodeId}</div>,
    TraceDetailPanelAnnotationBar: ({
      traceNodeId,
    }: {
      traceNodeId: string;
    }) => <div data-testid="trace-annotations">{traceNodeId}</div>,
    SpanDetailPanelAnnotationBar: ({
      queryRef,
    }: {
      queryRef: { spanNodeId: string };
    }) => <div data-testid="span-annotations">{queryRef.spanNodeId}</div>,
    useSpanDetailPanelAnnotationBarQuery: (spanNodeId: string) => ({
      queryRef: { spanNodeId },
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
    spanDetailsContentTestState.events = [];
    spanDetailsContentTestState.shouldSuspend = true;
    motionMocks.animate.mockClear();
    motionMocks.useReducedMotion.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("shows annotations for the selected span without a scope selector", () => {
    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const headers = container.querySelectorAll("[data-detail-header]");
    expect(headers).toHaveLength(1);
    expect(headers.item(0).textContent).toContain("selected span");
    expect(
      headers.item(0).querySelector("[data-testid='span-annotations']")
        ?.textContent
    ).toBe("span-node-id");

    expect(
      container.querySelector('button[aria-label^="Annotations for"]')
    ).toBeNull();
    expect(
      getComputedStyle(
        headers.item(0).querySelector<HTMLElement>(".detail-header__meta")!
      ).flexWrap
    ).toBe("nowrap");
  });

  it("clears an interrupted section-title highlight before animating the next title", async () => {
    spanDetailsContentTestState.shouldSuspend = false;
    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const inputLink = Array.from(container.querySelectorAll("nav a")).find(
      (link) => link.textContent === "Input"
    );
    const outputLink = Array.from(container.querySelectorAll("nav a")).find(
      (link) => link.textContent === "Output"
    );
    expect(inputLink).toBeDefined();
    expect(outputLink).toBeDefined();

    const user = userEvent.setup();
    await act(async () => user.click(inputLink!));
    const firstAnimation = motionMocks.animate.mock.results[0]?.value;
    const inputFeedback = container.querySelector<HTMLElement>(
      "#span-details-span-display-id-input [data-section-navigation-feedback]"
    );
    expect(firstAnimation).toBeDefined();
    expect(inputFeedback).not.toBeNull();

    inputFeedback!.style.opacity = "0.4";
    await act(async () => user.click(outputLink!));

    expect(firstAnimation?.cancel).toHaveBeenCalledOnce();
    expect(firstAnimation?.stop).not.toHaveBeenCalled();
    expect(inputFeedback?.style.opacity).toBe("");
    expect(motionMocks.animate).toHaveBeenCalledTimes(2);
  });

  it("separates regular and exception event counters", () => {
    spanDetailsContentTestState.events = [
      {
        attributes: {},
        message: "started",
        name: "start",
        timestamp: "2026-07-28T12:00:00.000Z",
      },
      {
        attributes: {},
        message: "continued",
        name: "progress",
        timestamp: "2026-07-28T12:00:01.000Z",
      },
      {
        attributes: {},
        message: "retried",
        name: "retry",
        timestamp: "2026-07-28T12:00:02.000Z",
      },
      {
        attributes: {},
        message: "failed",
        name: "exception",
        timestamp: "2026-07-28T12:00:03.000Z",
      },
    ];
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const eventLink = container.querySelector(
      'a[href="#span-details-span-display-id-events"]'
    );
    const eventSection = container.querySelector(
      "#span-details-span-display-id-events"
    );
    for (const eventCountContainer of [eventLink, eventSection]) {
      expect(
        Array.from(
          eventCountContainer?.querySelectorAll<HTMLElement>(".counter") ?? []
        ).map((counter) => ({
          count: counter.textContent,
          variant: counter.dataset.variant,
        }))
      ).toEqual([
        { count: "3", variant: "default" },
        { count: "1", variant: "danger" },
      ]);
    }
  });

  it("keeps the notes bar outside the scrolling sections", () => {
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const sectionsContent = container.querySelector(
      "[data-span-details-sections-content]"
    );
    const sectionsViewport = sectionsContent?.parentElement;
    const notesSection = container.querySelector("[data-span-details-notes]");
    const notesBar = container.querySelector("[data-span-details-notes-bar]");

    expect(sectionsViewport).not.toBeNull();
    expect(sectionsViewport?.contains(notesSection)).toBe(true);
    expect(sectionsViewport?.contains(notesBar)).toBe(false);
    expect(sectionsViewport?.nextElementSibling).toBe(notesBar);
    expect(notesBar?.textContent).toContain("Notes");
    expect(notesBar?.textContent).toContain("Take notes");
  });
});
