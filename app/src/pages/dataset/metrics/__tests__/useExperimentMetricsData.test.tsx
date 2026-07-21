import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ExperimentMetricsDataProvider,
  useExperimentAnnotationMetricNames,
} from "../useExperimentMetricsData";

describe("ExperimentMetricsDataProvider", () => {
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

  it("only owns the core experiment metrics request", async () => {
    const requestedOperations: string[] = [];
    const environment = new Environment({
      network: Network.create((operation) => {
        requestedOperations.push(operation.name);
        return Observable.create(() => undefined);
      }),
      store: new Store(new RecordSource()),
    });

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <ExperimentMetricsDataProvider datasetId="dataset-1">
            <div>metrics</div>
          </ExperimentMetricsDataProvider>
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations).toEqual(["useExperimentMetricsDataQuery"]);
    expect(container.textContent).toBe("metrics");
  });

  it("loads annotation names without requesting experiment metrics", async () => {
    const requestedOperations: string[] = [];
    const environment = new Environment({
      network: Network.create((operation) => {
        requestedOperations.push(operation.name);
        return Observable.create(() => undefined);
      }),
      store: new Store(new RecordSource()),
    });

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <>
            <Suspense fallback={<div>loading annotation names</div>}>
              <AnnotationNamesConsumer datasetId="dataset-1" />
            </Suspense>
          </>
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations).toEqual([
      "useExperimentAnnotationMetricNamesQuery",
    ]);
    expect(container.textContent).toBe("loading annotation names");
  });
});

function AnnotationNamesConsumer({ datasetId }: { datasetId: string }) {
  useExperimentAnnotationMetricNames(datasetId);
  return <div>annotation names</div>;
}
