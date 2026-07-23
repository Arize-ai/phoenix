import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as PhoenixComponents from "@phoenix/components";
import type * as PhoenixChart from "@phoenix/components/chart";

import { ExperimentsMetricsCharts } from "../ExperimentsMetricsCharts";

const datasetContextState = vi.hoisted(() => ({
  datasetId: "dataset-1",
  experimentsMetricChartKeys: ["latency"],
}));
const useExperimentMetricsDataMock = vi.hoisted(() => vi.fn());
const useExperimentAnnotationMetricDataMock = vi.hoisted(() => vi.fn());

vi.mock("@phoenix/contexts/DatasetContext", () => ({
  useDatasetContext: (
    selector: (state: typeof datasetContextState) => unknown
  ) => selector(datasetContextState),
}));

vi.mock("@phoenix/components", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixComponents>()),
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@phoenix/components/chart", async (importOriginal) => ({
  ...(await importOriginal<typeof PhoenixChart>()),
  ChartPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@phoenix/components/resize", () => ({
  transparentResizeHandleCSS: {},
}));

vi.mock("@phoenix/pages/dataset/metrics/useExperimentMetricsData", () => ({
  useExperimentMetricsData: useExperimentMetricsDataMock,
}));

vi.mock("@phoenix/pages/dataset/metrics/ExperimentLatencyChart", () => ({
  ExperimentLatencyChart: ({ datasetId }: { datasetId: string }) => {
    useExperimentMetricsDataMock(datasetId);
    return <div>core metric</div>;
  },
}));

vi.mock(
  "@phoenix/pages/dataset/metrics/ExperimentAnnotationMetricsGrid",
  () => ({
    ExperimentAnnotationMetricPanel: ({
      datasetId,
      annotationName,
    }: {
      datasetId: string;
      annotationName: string;
    }) => {
      useExperimentAnnotationMetricDataMock({ datasetId, annotationName });
      return <div>annotation metric</div>;
    },
  })
);

describe("ExperimentsMetricsCharts", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    datasetContextState.experimentsMetricChartKeys = ["latency"];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useExperimentMetricsDataMock.mockReset();
    useExperimentAnnotationMetricDataMock.mockReset();
  });

  it("loads core metrics for a built-in chart", () => {
    act(() => root.render(<ExperimentsMetricsCharts />));

    expect(useExperimentMetricsDataMock).toHaveBeenCalledExactlyOnceWith(
      "dataset-1"
    );
    expect(useExperimentAnnotationMetricDataMock).not.toHaveBeenCalled();
  });

  it("loads only the selected annotation metric", () => {
    datasetContextState.experimentsMetricChartKeys = ["annotation:quality"];

    act(() => root.render(<ExperimentsMetricsCharts />));

    expect(
      useExperimentAnnotationMetricDataMock
    ).toHaveBeenCalledExactlyOnceWith({
      datasetId: "dataset-1",
      annotationName: "quality",
    });
    expect(useExperimentMetricsDataMock).not.toHaveBeenCalled();
  });
});
