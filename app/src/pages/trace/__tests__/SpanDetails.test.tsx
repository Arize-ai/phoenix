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
  attributes: "{}",
  events: [] as {
    attributes: Record<string, unknown>;
    message: string;
    name: string;
    timestamp: string;
  }[],
  input: { value: "input", mimeType: "text" } as {
    value: string;
    mimeType: "text" | "json";
  } | null,
  output: { value: "output", mimeType: "text" } as {
    value: string;
    mimeType: "text" | "json";
  } | null,
  spanKind: "chain",
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
          spanKind: spanDetailsContentTestState.spanKind,
          input: spanDetailsContentTestState.input,
          output: spanDetailsContentTestState.output,
          attributes: spanDetailsContentTestState.attributes,
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
import { SpanDetailsContentSkeleton } from "../TraceDetailsSkeleton";

function TestProviders({
  children,
  initialEntry = "/",
  isTakingSpanNotes = false,
}: {
  children: ReactNode;
  initialEntry?: string;
  isTakingSpanNotes?: boolean;
}) {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
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
    spanDetailsContentTestState.attributes = "{}";
    spanDetailsContentTestState.events = [];
    spanDetailsContentTestState.input = {
      value: "input",
      mimeType: "text",
    };
    spanDetailsContentTestState.output = {
      value: "output",
      mimeType: "text",
    };
    spanDetailsContentTestState.spanKind = "chain";
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
    const identityRow = headers
      .item(0)
      .querySelector<HTMLElement>(".detail-header__identity")!;
    expect(getComputedStyle(identityRow).height).toBe(
      "var(--global-dimension-size-400)"
    );
    expect(getComputedStyle(identityRow).alignItems).toBe("center");
  });

  it("keeps neutral loading navigation the same height as loaded navigation", () => {
    spanDetailsContentTestState.shouldSuspend = false;
    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    const loadedNavigation = container.querySelector<HTMLElement>(
      'nav[aria-label="Span detail sections"]'
    );
    expect(loadedNavigation).not.toBeNull();
    const loadedNavigationHeight = getComputedStyle(loadedNavigation!).height;
    expect(loadedNavigationHeight).not.toBe("");

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetailsContentSkeleton />
        </TestProviders>
      );
    });

    const loadingNavigation = container.querySelector<HTMLElement>(
      'nav[aria-label="Loading span detail sections"]'
    );
    expect(loadingNavigation).not.toBeNull();
    expect(loadingNavigation?.textContent).toBe("");
    const loadingNavigationSkeletons = loadingNavigation?.querySelectorAll(
      ".span-details-navigation__placeholder .skeleton"
    );
    expect(loadingNavigationSkeletons).toHaveLength(4);
    loadingNavigationSkeletons?.forEach((skeleton) => {
      expect(getComputedStyle(skeleton).height).toBe("16px");
    });
    expect(getComputedStyle(loadingNavigation!).height).toBe(
      loadedNavigationHeight
    );
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

  it("opens a span detail section addressed by the route hash", () => {
    spanDetailsContentTestState.shouldSuspend = false;
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "scrollHeight"
    );
    const originalClientHeight = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "clientHeight"
    );
    const getBoundingClientRect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (this.hasAttribute("data-span-details-sections")) {
          return new DOMRect(0, 100);
        }
        if (this.id === "span-details-span-display-id-output") {
          return new DOMRect(0, 500);
        }
        return new DOMRect();
      });
    Object.defineProperty(Element.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return this instanceof Element &&
          this.hasAttribute("data-span-details-sections")
          ? 800
          : 0;
      },
    });
    Object.defineProperty(Element.prototype, "clientHeight", {
      configurable: true,
      get() {
        return this instanceof Element &&
          this.hasAttribute("data-span-details-sections")
          ? 200
          : 0;
      },
    });

    try {
      act(() => {
        root.render(
          <TestProviders initialEntry="/#span-details-span-display-id-output">
            <SpanDetails spanNodeId="span-node-id" />
          </TestProviders>
        );
      });

      expect(
        container.querySelector<HTMLElement>("[data-span-details-sections]")
          ?.scrollTop
      ).toBe(400);
    } finally {
      getBoundingClientRect.mockRestore();
      if (originalScrollHeight) {
        Object.defineProperty(
          Element.prototype,
          "scrollHeight",
          originalScrollHeight
        );
      } else {
        delete (Element.prototype as { scrollHeight?: number }).scrollHeight;
      }
      if (originalClientHeight) {
        Object.defineProperty(
          Element.prototype,
          "clientHeight",
          originalClientHeight
        );
      } else {
        delete (Element.prototype as { clientHeight?: number }).clientHeight;
      }
    }
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
    expect(
      container.querySelector(".span-details__content-absence")?.textContent
    ).toBe("No metadata or events");
  });

  it("states all missing LLM content in display order before attributes", () => {
    spanDetailsContentTestState.spanKind = "llm";
    spanDetailsContentTestState.input = null;
    spanDetailsContentTestState.output = null;
    spanDetailsContentTestState.attributes = JSON.stringify({
      metadata: { model: "unknown" },
    });
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    expect(
      Array.from(container.querySelectorAll("nav a")).map(
        (link) => link.textContent
      )
    ).toEqual(["Metadata", "Attributes", "Notes"]);

    const contentAbsence = container.querySelector(
      ".span-details__content-absence"
    );
    const attributesSection = container.querySelector(
      "#span-details-span-display-id-attributes"
    );
    expect(contentAbsence?.textContent).toBe(
      "No input, output, tool definitions, or events"
    );
    expect(contentAbsence?.nextElementSibling).toBe(attributesSection);
    expect(contentAbsence?.textContent).not.toContain("notes");
    const generatedClassName = Array.from(contentAbsence?.classList ?? []).find(
      (className) => className.startsWith("css-")
    );
    const contentAbsenceStyleRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === `.${generatedClassName}`
      );
    expect(contentAbsenceStyleRule?.cssText).toContain(
      "border-bottom: 1px solid var(--global-border-color-default)"
    );
    const contentAbsenceBorderedStyleRule = Array.from(document.styleSheets)
      .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText === `.${generatedClassName}[data-bordered="true"]`
      );
    expect(contentAbsence?.getAttribute("data-bordered")).toBe("true");
    expect(contentAbsenceBorderedStyleRule?.cssText).toContain(
      "border-top: 1px solid var(--global-border-color-default)"
    );
    expect(
      attributesSection
        ?.querySelector(".span-details-section-heading__header")
        ?.getAttribute("data-bordered")
    ).toBe("false");
  });

  it("does not double the border when the absence row is the first content", () => {
    spanDetailsContentTestState.spanKind = "llm";
    spanDetailsContentTestState.input = null;
    spanDetailsContentTestState.output = null;
    spanDetailsContentTestState.shouldSuspend = false;

    act(() => {
      root.render(
        <TestProviders>
          <SpanDetails spanNodeId="span-node-id" />
        </TestProviders>
      );
    });

    expect(
      container
        .querySelector(".span-details__content-absence")
        ?.getAttribute("data-bordered")
    ).toBe("false");
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
    const addNoteButton = notesBar?.querySelector(
      'button[aria-label="Add note"]'
    );
    expect(addNoteButton?.getAttribute("data-variant")).toBe("quiet");
    expect(addNoteButton?.getAttribute("data-childless")).toBe("true");
    expect(addNoteButton?.querySelector(".icon-wrap")).not.toBeNull();
    expect(
      notesBar?.querySelector('button[aria-label="Notes: jump to notes"]')
    ).toBeNull();
    expect(notesBar?.querySelector("kbd")?.textContent).toBe("N");
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
    spanDetailsContentTestState.spanNotes = [{ id: "note-id" }];
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

    act(() => {
      sectionsViewport.dispatchEvent(new Event("scroll"));
    });
    expect(jumpButton.disabled).toBe(false);

    act(() => jumpButton.click());

    expect(sectionsViewport.scrollTop).toBe(400);
    expect(jumpButton.disabled).toBe(true);
  });

  it("disables the notes bar title at the notes end and re-enables it above", () => {
    spanDetailsContentTestState.spanNotes = [{ id: "note-id" }];
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

    act(() => {
      sectionsViewport.scrollTop = 400;
      sectionsViewport.dispatchEvent(new Event("scroll"));
    });
    expect(jumpButton.disabled).toBe(true);

    act(() => {
      sectionsViewport.scrollTop = 320;
      sectionsViewport.dispatchEvent(new Event("scroll"));
    });
    expect(jumpButton.disabled).toBe(false);
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
    const addNoteButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Add note"]'
    );
    if (!(sectionsViewport instanceof HTMLElement) || addNoteButton == null) {
      throw new Error("Expected note authoring controls");
    }
    Object.defineProperties(sectionsViewport, {
      clientHeight: { configurable: true, value: 240 },
      scrollHeight: { configurable: true, value: 640 },
    });

    act(() => addNoteButton.click());

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
    ).toBeNull();
    expect(notesBar.querySelector('button[aria-label="Add note"]')).toBeNull();
    expect(sectionsContent?.getAttribute("data-note-composer-open")).toBe(
      "true"
    );
  });
});
