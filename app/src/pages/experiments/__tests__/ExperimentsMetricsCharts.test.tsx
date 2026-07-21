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
  const { useExperimentEvaluationMetricData } = await vi.importActual<
    typeof ExperimentMetricsDataModule
  >("@phoenix/pages/dataset/metrics/useExperimentMetricsData");

  function CoreMetricChart() {
    return <div>core metric</div>;
  }

  function EvaluationMetricChart({ datasetId }: { datasetId: string }) {
    useExperimentEvaluationMetricData({
      datasetId,
      evaluationName: "quality",
    });
    return <div>evaluation metric</div>;
  }

  return {
    getExperimentMetricCharts: (keys: string[]) =>
      keys.map((key) => {
        const isEvaluationChart = key.startsWith("evaluation:");
        return {
          key,
          name: key,
          description: key,
          Panel: isEvaluationChart ? EvaluationMetricChart : CoreMetricChart,
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

  it("provides the shared experiment metrics query", async () => {
    const requestedOperations: string[] = [];
    const environment = createPendingEnvironment(requestedOperations);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ExperimentsMetricsCharts />
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations).toEqual(["useExperimentMetricsDataQuery"]);
    expect(container.textContent).not.toContain("Something went wrong");
  });

  it("uses the shared query for the aggregate annotation chart", async () => {
    datasetContextState.experimentsMetricChartKeys = ["annotation_scores"];
    const requestedOperations: string[] = [];
    const environment = createPendingEnvironment(requestedOperations);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ExperimentsMetricsCharts />
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations).toEqual(["useExperimentMetricsDataQuery"]);
    expect(container.textContent).not.toContain("Something went wrong");
  });

  it("requests annotation aggregation for a selected evaluation chart", async () => {
    datasetContextState.experimentsMetricChartKeys = ["evaluation:quality"];
    const requestedOperations: string[] = [];
    const environment = createPendingEnvironment(requestedOperations);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ExperimentsMetricsCharts />
        </RelayEnvironmentProvider>
      );
    });

    expect(new Set(requestedOperations)).toEqual(
      new Set([
        "useExperimentMetricsDataQuery",
        "ExperimentEvaluationMetricQuery",
      ])
    );
  });
});

function createPendingEnvironment(requestedOperations: string[]) {
  return new Environment({
    network: Network.create((operation) => {
      requestedOperations.push(operation.name);
      return Observable.create(() => undefined);
    }),
    store: new Store(new RecordSource()),
  });
}
