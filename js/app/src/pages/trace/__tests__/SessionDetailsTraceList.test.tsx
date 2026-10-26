import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import { Environment, Network, RecordSource, Store } from "relay-runtime";
import { userEvent } from "storybook/test";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { PreferencesProvider } from "@phoenix/contexts/PreferencesContext";
import { ThemeProvider } from "@phoenix/contexts/ThemeContext";

import {
  SessionTurnList,
  type SessionTurnRow,
} from "../SessionDetailsTraceList";

function buildEval(
  name: string,
  meanScore: number,
  { count = 1, label }: { count?: number; label?: string } = {}
): AnnotationSummary {
  const labelFractions = label ? [{ label, fraction: 1 }] : [];
  return { name, count, meanScore, labelFractions };
}

/** A turn at minute `index` of the session, with only what the list reads. */
function buildRow({
  index,
  name,
  statusCode = "OK",
  tokens = 3,
  cost = 0.02,
  traceEvals = [],
  spanEvals = [],
}: {
  index: number;
  name: string;
  statusCode?: "OK" | "ERROR";
  tokens?: number;
  cost?: number | null;
  traceEvals?: AnnotationSummary[];
  spanEvals?: AnnotationSummary[];
}) {
  return {
    traceId: `trace-${index}`,
    rootSpan: {
      id: `span-node-${index}`,
      name,
      statusCode,
      startTime: `2026-07-22T12:0${index}:00.000Z`,
      endTime: `2026-07-22T12:0${index}:01.000Z`,
      latencyMs: 1000,
      input: null,
      output: null,
      cumulativeTokenCountTotal: tokens,
      summarySpanAnnotationSummaries: spanEvals,
      trace: {
        id: `trace-node-${index}`,
        costSummary: { total: { cost } },
        summaryTraceAnnotationSummaries: traceEvals,
      },
    },
  } as unknown as SessionTurnRow;
}

/** metric_9 sorts last by name, and is the only unfavorable one. */
const METRIC_NAMES = Array.from(
  { length: 10 },
  (_, index) => `metric_${index}`
);

const rows = [
  buildRow({ index: 1, name: "First turn" }),
  buildRow({
    index: 2,
    name: "Second turn",
    statusCode: "ERROR",
    cost: null,
    traceEvals: [buildEval("correctness", 0, { count: 2, label: "incorrect" })],
    spanEvals: [buildEval("correctness", 1)],
  }),
  buildRow({
    index: 3,
    name: "Third turn",
    traceEvals: METRIC_NAMES.map((name) =>
      buildEval(name, name === "metric_9" ? 0 : 1)
    ),
  }),
  buildRow({ index: 4, name: "Free turn", tokens: 0, cost: 0 }),
];

/** Unfavorable below 0.5 */
const MAXIMIZE_CONFIG: AnnotationOptimizationConfig = {
  annotationType: "CONTINUOUS",
  optimizationDirection: "MAXIMIZE",
  lowerBound: 0,
  upperBound: 1,
};

/** Past the preview's open delay, and its usage fetch's settle delay */
const PAST_PREVIEW_DELAYS_MS = 300;

/**
 * Answers the preview's usage query for any turn with the same split: two
 * prompt tokens and one completion token.
 */
function createTestEnvironment(onFetch: (traceNodeId: unknown) => void) {
  return new Environment({
    network: Network.create((operation, variables) => {
      if (operation.name !== "SessionTurnPreviewTooltipUsageQuery") {
        throw new Error(`Unexpected query ${operation.name}`);
      }
      onFetch(variables.traceNodeId);
      const cost = (value: number) => ({ cost: value });
      return {
        data: {
          node: {
            __typename: "Trace",
            id: variables.traceNodeId,
            rootSpan: {
              id: `${variables.traceNodeId}-root`,
              cumulativeTokenCountTotal: 3,
              cumulativeTokenCountPrompt: 2,
              cumulativeTokenCountCompletion: 1,
              cumulativeCostDetailSummaryEntries: [],
            },
            costSummary: {
              total: cost(0.02),
              prompt: cost(0.015),
              completion: cost(0.005),
            },
            costDetailSummaryEntries: [],
          },
        },
      };
    }),
    store: new Store(new RecordSource()),
  });
}

function getTooltip() {
  return document.querySelector<HTMLElement>('[role="tooltip"]');
}

function waitForPreview(text: string) {
  return vi.waitFor(() => expect(getTooltip()?.textContent).toContain(text));
}

function waitForNoPreview() {
  return vi.waitFor(() => expect(getTooltip()).toBeNull());
}

function getEvalGroupHeadings() {
  const sections = getTooltip()?.querySelectorAll("section[aria-labelledby]");
  return Array.from(sections ?? []).map(
    (section) =>
      document.getElementById(section.getAttribute("aria-labelledby")!)
        ?.textContent
  );
}

function waitOutPreviewDelays() {
  return act(() => vi.advanceTimersByTimeAsync(PAST_PREVIEW_DELAYS_MS));
}

async function expectNoPreviewToOpen() {
  await waitOutPreviewDelays();
  expect(getTooltip()).toBeNull();
}

describe("SessionTurnList", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onFetch: Mock<(traceNodeId: unknown) => void>;
  let environment: Environment;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })
    );
    onFetch = vi.fn();
    environment = createTestEnvironment(onFetch);
    user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function renderTurnList({
    onTurnClick = vi.fn(),
    onTurnDoubleClick = vi.fn(),
    turnRows = rows,
    annotationConfigsByName = new Map(),
  }: {
    onTurnClick?: (traceId: string) => void;
    onTurnDoubleClick?: (turn: { traceId: string; spanNodeId: string }) => void;
    turnRows?: ReadonlyArray<SessionTurnRow>;
    annotationConfigsByName?: ReadonlyMap<string, AnnotationOptimizationConfig>;
  } = {}) {
    act(() => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ThemeProvider themeMode="dark">
            <PreferencesProvider>
              <SessionTurnList
                rows={turnRows}
                selectedTraceId={null}
                onTurnClick={onTurnClick}
                onTurnDoubleClick={onTurnDoubleClick}
                annotationConfigsByName={annotationConfigsByName}
              />
            </PreferencesProvider>
          </ThemeProvider>
        </RelayEnvironmentProvider>
      );
    });
  }

  function getTurn(index: number) {
    return container.querySelectorAll<HTMLElement>('[role="option"]')[index];
  }

  const clickTurn = (index: number) => act(() => user.click(getTurn(index)));
  const hoverTurn = (index: number) => act(() => user.hover(getTurn(index)));
  const unhoverTurn = (index: number) =>
    act(() => user.unhover(getTurn(index)));
  const pressKey = (key: string) => act(() => user.keyboard(key));

  /**
   * jsdom doesn't lay out, so focusing a row never scrolls the list; send the
   * scroll that arrowing past the fold would, which React Aria's tooltip
   * closes on.
   */
  const scrollList = () =>
    act(async () => {
      container
        .querySelector('[role="listbox"]')
        ?.dispatchEvent(new Event("scroll"));
    });

  /**
   * Clicks the first turn, then arrows down to the second. The click renders
   * the items while focus is not visible, which the preview must not depend on.
   */
  async function arrowToSecondTurn() {
    await clickTurn(0);
    await pressKey("{ArrowDown}");
    await waitForPreview("Second turn");
  }

  it("keeps a single click scoped to turn selection", async () => {
    const onTurnClick = vi.fn();
    const onTurnDoubleClick = vi.fn();
    renderTurnList({ onTurnClick, onTurnDoubleClick });

    await clickTurn(1);

    expect(onTurnClick).toHaveBeenCalledWith("trace-2");
    expect(onTurnDoubleClick).not.toHaveBeenCalled();
  });

  it("identifies the trace and root span when a turn is double-clicked", async () => {
    const onTurnDoubleClick = vi.fn();
    renderTurnList({ onTurnDoubleClick });

    await act(() => user.dblClick(getTurn(1)));

    expect(onTurnDoubleClick).toHaveBeenCalledExactlyOnceWith({
      traceId: "trace-2",
      spanNodeId: "span-node-2",
    });
  });

  it("previews a turn without evals, loading its split only when it has usage", async () => {
    renderTurnList();

    await hoverTurn(3);
    await waitForPreview("Free turn");
    await waitOutPreviewDelays();
    expect(getTooltip()?.querySelector(".token-details-breakdown")).toBeNull();
    await unhoverTurn(3);
    await waitForNoPreview();
    expect(onFetch).not.toHaveBeenCalled();

    await hoverTurn(0);
    await waitForPreview("First turn");
    expect(getTooltip()?.querySelector("section")).toBeNull();
    expect(getTooltip()?.querySelector('[aria-label="ERROR"]')).toBeNull();
    await waitForPreview("2 prompt → 1 completion");
    expect(onFetch).toHaveBeenCalledExactlyOnceWith("trace-node-1");
  });

  it("previews a turn's evals by group, each capped with unfavorable ones first", async () => {
    renderTurnList({
      annotationConfigsByName: new Map(
        [...METRIC_NAMES, "correctness"].map((name) => [name, MAXIMIZE_CONFIG])
      ),
    });

    // Trace evals only: the empty Root span group renders nothing
    await hoverTurn(2);
    await waitForPreview("+8 more");
    expect(getEvalGroupHeadings()).toEqual(["Trace"]);
    const text = getTooltip()?.textContent ?? "";
    expect(METRIC_NAMES.filter((name) => text.includes(name))).toEqual([
      "metric_0",
      "metric_9",
    ]);
    await unhoverTurn(2);

    await hoverTurn(1);
    await waitForPreview("Second turn");
    expect(getEvalGroupHeadings()).toEqual(["Trace", "Root span"]);
    expect(getTooltip()?.querySelector('[aria-label="ERROR"]')).not.toBeNull();
    // Label and mean score as one tinted value, with no unfavorable tally
    const value = getTooltip()?.querySelector(
      ".span-preview-annotation__value"
    );
    expect(value?.textContent).toMatch(/incorrect.*μ/);
    expect(value?.querySelector('[data-direction="negative"]')).not.toBeNull();
    expect(getTooltip()?.textContent).not.toMatch(/of \d+ unfavorable/);
  });

  it("follows the turn's refetched data while open", async () => {
    renderTurnList();
    await hoverTurn(0);
    await waitForPreview("First turn");

    renderTurnList({
      turnRows: [
        buildRow({ index: 1, name: "Renamed turn" }),
        ...rows.slice(1),
      ],
    });

    await waitForPreview("Renamed turn");
  });

  it("closes a hovered preview on scroll and on click, and Escape after the click opens nothing", async () => {
    renderTurnList();

    await hoverTurn(0);
    await waitForPreview("First turn");
    await scrollList();
    await waitForNoPreview();
    await unhoverTurn(0);

    await hoverTurn(1);
    await waitForPreview("Second turn");
    await clickTurn(1);
    await waitForNoPreview();

    // The key makes focus visible on the clicked row
    await unhoverTurn(1);
    await pressKey("{Escape}");
    await expectNoPreviewToOpen();
  });

  it("keeps a keyboard preview through list scrolls and hovers, until its row scrolls out of view", async () => {
    renderTurnList();
    await arrowToSecondTurn();

    await scrollList();
    expect(getTooltip()?.textContent).toContain("Second turn");

    // As a row scrolling under a still pointer is
    await hoverTurn(2);
    expect(getTooltip()?.textContent).toContain("Second turn");
    await unhoverTurn(2);
    expect(getTooltip()?.textContent).toContain("Second turn");

    // As a wheel scroll moves the focused row above the viewport
    vi.spyOn(getTurn(1), "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: -200, width: 300, height: 80 })
    );
    await scrollList();
    await waitForNoPreview();
    await expectNoPreviewToOpen();

    await pressKey("{ArrowDown}");
    await waitForPreview("Third turn");
  });

  it("dismisses only the preview on the first Escape", async () => {
    // Where the session drawer listens for Escape
    const onDocumentEscape = vi.fn();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDocumentEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    try {
      renderTurnList();
      await arrowToSecondTurn();

      await pressKey("{Escape}");
      await waitForNoPreview();
      expect(onDocumentEscape).not.toHaveBeenCalled();
      await expectNoPreviewToOpen();

      await pressKey("{Escape}");
      expect(onDocumentEscape).toHaveBeenCalledOnce();

      await pressKey("{ArrowDown}");
      await waitForPreview("Third turn");
    } finally {
      document.removeEventListener("keydown", onKeyDown);
    }
  });
});
