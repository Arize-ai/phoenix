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
  timeBinConfig: { scale: "DAY", utcOffsetMinutes: 0 },
  windowKey: "7d",
};

const SERIES = Array.from({ length: 7 }, (_, day) => ({
  timestamp: `2026-01-0${day + 1}T00:00:00.000Z`,
  meanScore: null,
  count: 0,
}));

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
    series: SERIES.map((bin) => ({
      ...bin,
      meanScore: meanScore,
      count: meanScore == null ? 0 : 10,
    })),
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

const getBar = () =>
  container.querySelector('[data-testid="label-distribution-bar"]');

const getSegmentColors = () =>
  [...container.querySelectorAll<HTMLElement>(".segment-chart__segment")].map(
    (segment) => segment.style.backgroundColor
  );

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
  it("shows the leading label's share and a distribution bar for a label-only annotation", () => {
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
    expect(getBar()?.getAttribute("aria-label")).toBe(
      "tone labels over the last 7d: positive 50%, neutral 36%, negative 14%"
    );
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
    expect(container.textContent).toContain("▲ 12pp");
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
    expect(container.textContent).toContain("▲ 100pp");
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
    expect(container.textContent).toContain("▼ 10pp");
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
    expect(getBar()).toBeNull();
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
    expect(getBar()).toBeNull();
  });
});
