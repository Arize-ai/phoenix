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
  spanNotes: [] as { id: string }[],
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
  useMutation: vi.fn(() => [vi.fn(), false]),
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
          spanNotes: spanDetailsContentTestState.spanNotes,
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
import { SpanNoteBarProvider } from "../SpanNoteBarContext";

function TestProviders({
  children,
  isTakingSpanNotes = false,
}: {
  children: ReactNode;
  isTakingSpanNotes?: boolean;
}) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <PreferencesProvider isTakingSpanNotes={isTakingSpanNotes}>
          <SpanInfoCardsProvider>
            <SpanNoteBarProvider isHotkeyEnabled={false}>
              <Suspense fallback={null}>{children}</Suspense>
            </SpanNoteBarProvider>
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
    localStorage.removeItem("arize-phoenix-preferences");
    spanDetailsContentTestState.events = [];
    spanDetailsContentTestState.spanNotes = [];
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

  it("omits the events navigation and section when there are no events", () => {
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    expect(
      container.querySelector('a[href="#span-details-span-display-id-events"]')
    ).toBeNull();
    expect(
      container.querySelector("#span-details-span-display-id-events")
    ).toBeNull();
  });

  it("omits notes counters when there are no notes", () => {
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const notesLink = container.querySelector(
      'a[href="#span-details-span-display-id-notes"]'
    );
    const notesBar = container.querySelector("[data-span-details-notes-bar]");

    expect(notesLink?.textContent).toBe("Notes");
    expect(notesLink?.querySelector(".counter")).toBeNull();
    expect(notesBar?.textContent).toContain("Notes");
    expect(notesBar?.querySelector(".counter")).toBeNull();
    const takeNotesButton = notesBar?.querySelector(
      'button[aria-label="Take notes"]'
    );
    expect(takeNotesButton?.getAttribute("data-variant")).toBe("quiet");
    expect(takeNotesButton?.getAttribute("data-childless")).toBe("true");
    expect(takeNotesButton?.querySelector(".icon-wrap")).not.toBeNull();
    expect(
      notesBar?.querySelector('button[aria-label="Notes: jump to notes"] kbd')
        ?.textContent
    ).toBe("N");
  });

  it("shows notes counters when there are notes", () => {
    spanDetailsContentTestState.spanNotes = [{ id: "note-id" }];
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const notesLink = container.querySelector(
      'a[href="#span-details-span-display-id-notes"]'
    );
    const notesBar = container.querySelector("[data-span-details-notes-bar]");

    expect(notesLink?.querySelector(".counter")?.textContent).toBe("1");
    expect(notesBar?.querySelector(".counter")?.textContent).toBe("1");
  });

  it("keeps the notes bar sticky until its place above the notes content", () => {
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
    const notesBar = container.querySelector<HTMLElement>(
      "[data-span-details-notes-bar]"
    );

    expect(sectionsViewport).not.toBeNull();
    expect(sectionsViewport?.contains(notesSection)).toBe(true);
    expect(sectionsContent?.contains(notesBar)).toBe(true);
    expect(notesBar?.nextElementSibling).toBe(notesSection);
    expect(getComputedStyle(notesBar!).position).toBe("sticky");
    expect(getComputedStyle(notesBar!).bottom).toBe("0px");
    expect(getComputedStyle(notesBar!).flexShrink).toBe("0");
    expect(getComputedStyle(notesBar!).marginTop).toBe("auto");
    expect(notesBar?.textContent).toContain("Notes");
  });

  it("jumps to the notes end from the notes bar title", () => {
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
    const jumpButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Notes: jump to notes"]'
    );
    if (!(sectionsViewport instanceof HTMLElement) || jumpButton == null) {
      throw new Error("Expected notes navigation controls");
    }
    Object.defineProperties(sectionsViewport, {
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 640 },
    });

    act(() => jumpButton.click());

    expect(sectionsViewport.scrollTop).toBe(400);
  });

  it("overlays the composer above the sticky notes header without moving the viewport", () => {
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
    const takeNotesButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Take notes"]'
    );
    if (!(sectionsViewport instanceof HTMLElement) || takeNotesButton == null) {
      throw new Error("Expected note authoring controls");
    }
    Object.defineProperties(sectionsViewport, {
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 640 },
    });

    act(() => takeNotesButton.click());

    const notesBar = container.querySelector<HTMLElement>(
      "[data-span-details-notes-bar]"
    );
    const composer = container.querySelector<HTMLElement>(
      "[data-span-note-composer-overlay]"
    );
    if (notesBar == null || composer == null) {
      throw new Error("Expected the notes header and composer overlay");
    }
    expect(sectionsViewport.scrollTop).toBe(0);
    expect(composer.querySelector(".span-note-bar")).not.toBeNull();
    expect(getComputedStyle(composer).position).toBe("absolute");
    expect(getComputedStyle(composer).zIndex).toBe(
      "var(--global-z-index-local-overlay)"
    );
    expect(getComputedStyle(notesBar).zIndex).toBe(
      "var(--global-z-index-local-raised)"
    );
    expect(
      notesBar.querySelector('button[aria-label="Notes: jump to notes"]')
    ).not.toBeNull();
    expect(
      notesBar.querySelector('button[aria-label="Take notes"]')
    ).toBeNull();
    expect(sectionsContent?.getAttribute("data-note-composer-open")).toBe(
      "true"
    );
  });
});
