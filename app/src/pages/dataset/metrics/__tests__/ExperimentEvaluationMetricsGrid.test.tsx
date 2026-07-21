import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentEvaluationMetricsGrid } from "../ExperimentEvaluationMetricsGrid";

vi.mock("@phoenix/components", () => ({
  Flex: ({ children }: { children: ReactNode }) => children,
  Loading: () => <div>loading annotations</div>,
  Text: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@phoenix/components/experiment", () => ({
  BaselineExperimentBadge: () => null,
}));

vi.mock("@phoenix/components/experiment/SequenceNumberToken", () => ({
  SequenceNumberToken: () => null,
}));

vi.mock("@phoenix/components/chart", () => ({
  ChartPanel: ({ children }: { children: ReactNode }) => children,
  EvaluationMetricsChart: () => null,
  EvaluationMetricsViewToggle: () => null,
  compactCategoryXAxisProps: {},
  compactYAxisProps: {},
  getDefaultEvaluationMetricsView: () => "labels",
  normalizeEvaluationMetrics: () => [],
}));

vi.mock("@phoenix/components/exception", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("../useExperimentMetricsData", () => ({
  useExperimentAnnotationMetricNames: () => {
    throw new Promise(() => undefined);
  },
}));

describe("ExperimentEvaluationMetricsGrid", () => {
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

  it("renders non-annotation grid children while annotations are pending", () => {
    act(() => {
      root.render(
        <ExperimentEvaluationMetricsGrid datasetId="dataset-1">
          <div>token and error charts</div>
        </ExperimentEvaluationMetricsGrid>
      );
    });

    expect(container.textContent).toContain("token and error charts");
  });
});
