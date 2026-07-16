import { act } from "react";
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

import { ExperimentMetricsDataProvider } from "../useExperimentMetricsData";

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

  it("starts core and annotation metrics requests without a waterfall", async () => {
    const requestedOperations: string[] = [];
    const environment = new Environment({
      network: Network.create((operation) => {
        requestedOperations.push(operation.name);
        // Keep both requests pending: observing both names proves the second
        // request does not depend on the first response completing.
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

    expect(requestedOperations).toHaveLength(2);
    expect(new Set(requestedOperations)).toEqual(
      new Set([
        "useExperimentMetricsDataQuery",
        "useExperimentAnnotationMetricsDataQuery",
      ])
    );
    expect(container.textContent).toBe("metrics");
  });
});
