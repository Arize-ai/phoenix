import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";
import type { ProjectEvaluatorResultAnnotation } from "@phoenix/hooks/useProjectEvaluatorResultAnnotations";
import {
  type EvaluatorAnnotationScoreMetricsData,
  EvaluatorScoreWindowProvider,
  ProjectEvaluatorMeanScoreCell,
} from "@phoenix/pages/project/evaluators/ProjectEvaluatorMeanScoreCell";
import type { EvaluatorScoreWindow } from "@phoenix/pages/project/evaluators/projectEvaluatorScoreWindow";

installTestMatchMedia();

const SCORE_WINDOW: EvaluatorScoreWindow = {
  timeRange: {
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-01-08T00:00:00.000Z",
  },
  previousTimeRange: {
    start: "2025-12-25T00:00:00.000Z",
    end: "2026-01-01T00:00:00.000Z",
  },
  timeBinConfig: { scale: "DAY", utcOffsetMinutes: 0 },
  windowKey: "7d",
};

const SERIES = Array.from({ length: 7 }, (_, day) => ({
  timestamp: `2026-01-0${day + 1}T00:00:00.000Z`,
}));

/** Results per bin: ten on every day except the fourth, which is empty. */
const BIN_RESULT_COUNTS = [10, 10, 10, 0, 10, 10, 10];

function makeMetrics({
  annotationName,
  meanScore = null,
  labelFractions,
  previousLabelFractions = [],
  previousMeanScore = null,
}: {
  annotationName: string;
  meanScore?: number | null;
  labelFractions: { label: string; fraction: number }[];
  previousLabelFractions?: { label: string; fraction: number }[];
  previousMeanScore?: number | null;
}): EvaluatorAnnotationScoreMetricsData {
  return {
    annotationName,
    summary: {
      meanScore,
      count: 100,
      scoreCount: meanScore == null ? 0 : 100,
      labelCount: 100,
      labelFractions,
    },
    previousSummary: {
      meanScore: previousMeanScore,
      labelFractions: previousLabelFractions,
    },
    series: SERIES.map((bin, index) => {
      const resultCount =
        labelFractions.length > 0 ? BIN_RESULT_COUNTS[index] : 0;
      return {
        ...bin,
        meanScore: resultCount > 0 ? meanScore : null,
        count: meanScore == null ? 0 : resultCount,
        labelFractions: resultCount > 0 ? labelFractions : [],
        resultCount,
      };
    }),
  };
}

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

function renderCell(
  annotation: ProjectEvaluatorResultAnnotation,
  metrics: EvaluatorAnnotationScoreMetricsData
) {
  act(() => {
    root.render(
      <ThemeProvider themeMode="light">
        <PreferencesProvider>
          <EvaluatorScoreWindowProvider value={SCORE_WINDOW}>
            <ProjectEvaluatorMeanScoreCell
              annotations={[annotation]}
              scoreMetrics={[metrics]}
            />
          </EvaluatorScoreWindowProvider>
        </PreferencesProvider>
      </ThemeProvider>
    );
  });
}

/** The label columns' svg, when the cell draws them. */
const getColumnsChart = () => container.querySelector(".stacked-sparkline svg");

const getColumns = () => [
  ...container.querySelectorAll(".stacked-sparkline__column"),
];

/** The first column's segment fills, bottom to top. */
const getSegmentColors = () =>
  [
    ...(getColumns()[0]?.querySelectorAll(".stacked-sparkline__segment") ?? []),
  ].map((segment) => segment.getAttribute("fill"));

const UNSCORED_TONE: ProjectEvaluatorResultAnnotation = {
  name: "tone",
  config: {
    annotationType: "CATEGORICAL",
    optimizationDirection: "NONE",
    values: [
      { label: "positive", score: null },
      { label: "neutral", score: null },
      { label: "negative", score: null },
    ],
  },
};

describe("ProjectEvaluatorMeanScoreCell", () => {
  it("shows the leading label's share and per-bin label columns for a label-only annotation", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({
        annotationName: "tone",
        // The server sends labels alphabetically
        labelFractions: [
          { label: "negative", fraction: 0.14 },
          { label: "neutral", fraction: 0.36 },
          { label: "positive", fraction: 0.5 },
        ],
      })
    );
    expect(container.textContent).toContain("positive\u00a050%");
    expect(container.textContent).not.toContain("--");
    expect(getColumnsChart()?.querySelector("title")?.textContent).toBe(
      "tone labels per bin over the last 7d"
    );
    // One column per bin with labels; the empty fourth day stays blank
    expect(
      getColumns().map((column) => column.getAttribute("data-position"))
    ).toEqual(["0", "1", "2", "4", "5", "6"]);
    // No score sparkline beside the columns
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("shows a column's time, label shares and counts on hover", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({
        annotationName: "tone",
        labelFractions: [
          { label: "negative", fraction: 0.1 },
          { label: "neutral", fraction: 0.4 },
          { label: "positive", fraction: 0.5 },
        ],
      })
    );
    const svg = getColumnsChart();
    if (!(svg instanceof SVGSVGElement)) {
      throw new Error("expected the label columns");
    }
    svg.getBoundingClientRect = () =>
      ({ left: 0, width: 70, top: 0, height: 20 }) as DOMRect;
    act(() => {
      // Seven bins over 70px: the pointer at 5px is over the first column
      svg.dispatchEvent(
        new MouseEvent("pointermove", { bubbles: true, clientX: 5 })
      );
    });
    const tooltip = document.body.textContent ?? "";
    expect(tooltip).toContain("n=10");
    expect(tooltip).toContain("positive50% · n=5");
    expect(tooltip).toContain("neutral40% · n=4");
    expect(tooltip).toContain("negative10% · n=1");
  });

  it("colors a label the same whatever the window's shares", () => {
    const colorsFor = (
      labelFractions: { label: string; fraction: number }[]
    ) => {
      renderCell(
        UNSCORED_TONE,
        makeMetrics({ annotationName: "tone", labelFractions })
      );
      return getSegmentColors();
    };
    const mostlyPositive = colorsFor([
      { label: "negative", fraction: 0.1 },
      { label: "neutral", fraction: 0.2 },
      { label: "positive", fraction: 0.7 },
    ]);
    const mostlyNegative = colorsFor([
      { label: "negative", fraction: 0.7 },
      { label: "neutral", fraction: 0.2 },
      { label: "positive", fraction: 0.1 },
    ]);
    expect(mostlyNegative).toEqual(mostlyPositive);
    expect(new Set(mostlyPositive).size).toBe(3);
  });

  it("draws the first config label in the categorical accent, the rest in the faintest grays first", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({
        annotationName: "tone",
        labelFractions: [
          { label: "negative", fraction: 0.14 },
          { label: "neutral", fraction: 0.36 },
          { label: "positive", fraction: 0.5 },
        ],
      })
    );
    expect(getSegmentColors()).toEqual([
      "var(--global-color-indigo-600)",
      "var(--global-color-gray-400)",
      "var(--global-color-gray-500)",
    ]);
  });

  it("cycles only the grays past the palette, keeping the accent for the first label", () => {
    const labels = ["a", "b", "c", "d", "e", "f", "g"];
    renderCell(
      {
        name: "topic",
        config: {
          annotationType: "CATEGORICAL",
          optimizationDirection: "NONE",
          values: labels.map((label) => ({ label, score: null })),
        },
      },
      makeMetrics({
        annotationName: "topic",
        labelFractions: labels.map((label) => ({ label, fraction: 1 / 7 })),
      })
    );
    const colors = getSegmentColors();
    expect(colors).toHaveLength(7);
    expect(colors[0]).toBe("var(--global-color-indigo-600)");
    expect(colors.slice(1)).not.toContain("var(--global-color-indigo-600)");
    // The four grays, then around again
    expect(colors.slice(1)).toEqual([
      "var(--global-color-gray-400)",
      "var(--global-color-gray-500)",
      "var(--global-color-gray-600)",
      "var(--global-color-gray-800)",
      "var(--global-color-gray-400)",
      "var(--global-color-gray-500)",
    ]);
  });

  it("shows the change in the leading label's share in percentage points", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({
        annotationName: "tone",
        labelFractions: [
          { label: "neutral", fraction: 0.4 },
          { label: "positive", fraction: 0.6 },
        ],
        previousLabelFractions: [
          { label: "neutral", fraction: 0.52 },
          { label: "positive", fraction: 0.48 },
        ],
      })
    );
    expect(container.textContent).toContain("▲ 12 pts");
  });

  it("counts a label missing from the previous window as a zero share", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({
        annotationName: "tone",
        labelFractions: [{ label: "positive", fraction: 1 }],
        previousLabelFractions: [{ label: "negative", fraction: 1 }],
      })
    );
    expect(container.textContent).toContain("▲ 100 pts");
  });

  it("shows no change without previous labels", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({
        annotationName: "tone",
        labelFractions: [{ label: "positive", fraction: 1 }],
      })
    );
    expect(container.textContent).not.toMatch(/[▲▼]/);
  });

  it("marks a share change good or bad when the config scores the leading label", () => {
    const annotation: ProjectEvaluatorResultAnnotation = {
      name: "is_correct",
      config: {
        annotationType: "CATEGORICAL",
        optimizationDirection: "MAXIMIZE",
        values: [
          { label: "correct", score: 1 },
          { label: "incorrect", score: 0 },
        ],
      },
    };
    renderCell(
      annotation,
      makeMetrics({
        annotationName: "is_correct",
        labelFractions: [
          { label: "correct", fraction: 0.7 },
          { label: "incorrect", fraction: 0.3 },
        ],
        previousLabelFractions: [
          { label: "correct", fraction: 0.8 },
          { label: "incorrect", fraction: 0.2 },
        ],
      })
    );
    expect(container.textContent).toContain("correct\u00a070%");
    expect(container.textContent).toContain("▼ 10 pts");
    // The leading label is the good one, so its pill carries a direction
    expect(
      container.querySelector('[data-direction="positive"]')
    ).not.toBeNull();
  });

  it("keeps the score sparkline for an annotation with scores and labels", () => {
    renderCell(
      {
        name: "faithful",
        config: {
          annotationType: "CATEGORICAL",
          optimizationDirection: "MAXIMIZE",
          values: [
            { label: "faithful", score: 1 },
            { label: "hallucinated", score: 0 },
          ],
        },
      },
      makeMetrics({
        annotationName: "faithful",
        meanScore: 0.8,
        previousMeanScore: 0.9,
        labelFractions: [
          { label: "faithful", fraction: 0.8 },
          { label: "hallucinated", fraction: 0.2 },
        ],
      })
    );
    expect(getColumnsChart()).toBeNull();
    expect(container.querySelector("svg[role='img']")).not.toBeNull();
    expect(container.textContent).toContain("0.80");
    expect(container.textContent).toContain("▼ 0.10");
  });

  it("shows -- when the annotation has neither scores nor labels", () => {
    renderCell(
      UNSCORED_TONE,
      makeMetrics({ annotationName: "tone", labelFractions: [] })
    );
    expect(container.textContent).toBe("--");
    expect(getColumnsChart()).toBeNull();
  });
});
