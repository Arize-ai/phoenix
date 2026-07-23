import { act, type ReactNode, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ExperimentAnnotationMetricsDataModule from "@phoenix/pages/dataset/metrics/useExperimentAnnotationMetricsData";
import type * as ExperimentMetricsDataModule from "@phoenix/pages/dataset/metrics/useExperimentMetricsData";

import { ExperimentsMetricsCharts } from "../ExperimentsMetricsCharts";

const datasetContextState = vi.hoisted(() => ({
  datasetId: "dataset-1",
  experimentsMetricChartKeys: ["latency"],
}));

vi.mock("@phoenix/contexts/DatasetContext", () => ({
  useDatasetContext: (
    selector: (state: typeof datasetContextState) => unknown
  ) => selector(datasetContextState),
}));

vi.mock("@phoenix/components", () => ({
  Loading: () => <div>loading</div>,
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@phoenix/components/chart", () => ({
  ChartPanel: ({ children }: { children: ReactNode }) => (
    <Suspense fallback={<div>loading chart</div>}>{children}</Suspense>
  ),
}));

vi.mock("@phoenix/components/resize", () => ({
  transparentResizeHandleCSS: {},
}));

vi.mock("@phoenix/pages/dataset/metrics/chartCatalog", async () => {
  const { useExperimentMetricsData } = await vi.importActual<
    typeof ExperimentMetricsDataModule
  >("@phoenix/pages/dataset/metrics/useExperimentMetricsData");
  const { useExperimentAnnotationMetricData } = await vi.importActual<
    typeof ExperimentAnnotationMetricsDataModule
  >("@phoenix/pages/dataset/metrics/useExperimentAnnotationMetricsData");

  function CoreMetricChart({ datasetId }: { datasetId: string }) {
    useExperimentMetricsData(datasetId);
    return <div>core metric</div>;
  }

  function AnnotationMetricChart({ datasetId }: { datasetId: string }) {
    useExperimentAnnotationMetricData({
      datasetId,
      annotationName: "quality",
    });
    return <div>annotation metric</div>;
  }

  return {
    getExperimentMetricCharts: (keys: string[]) =>
      keys.map((key) => {
        const isAnnotationChart = key.startsWith("annotation:");
        return {
          key,
          name: key,
          description: key,
          Panel: isAnnotationChart ? AnnotationMetricChart : CoreMetricChart,
        };
      }),
  };
});

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
  });

  it("requests only core metrics for a built-in chart", async () => {
    const requestedOperations: RequestedOperation[] = [];
    const environment = createPendingEnvironment(requestedOperations);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ExperimentsMetricsCharts />
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations.map(({ name }) => name)).toEqual([
      "useExperimentMetricsDataQuery",
    ]);
    expect(container.textContent).not.toContain("Something went wrong");
  });

  it("requests only the selected annotation's metrics", async () => {
    datasetContextState.experimentsMetricChartKeys = ["annotation:quality"];
    const requestedOperations: RequestedOperation[] = [];
    const environment = createPendingEnvironment(requestedOperations);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ExperimentsMetricsCharts />
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations).toEqual([
      {
        name: "ExperimentAnnotationMetricQuery",
        variables: {
          annotationName: "quality",
          count: 7,
          id: "dataset-1",
        },
      },
    ]);
  });
});

type RequestedOperation = {
  name: string;
  variables: Record<string, unknown>;
};

function createPendingEnvironment(requestedOperations: RequestedOperation[]) {
  return new Environment({
    network: Network.create((operation, variables) => {
      requestedOperations.push({
        name: operation.name,
        variables,
      });
      return Observable.create(() => undefined);
    }),
    store: new Store(new RecordSource()),
  });
}
