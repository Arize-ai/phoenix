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

import { useExperimentAnnotationMetricNames } from "../useExperimentAnnotationMetricNames";

describe("useExperimentAnnotationMetricNames", () => {
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

  it("loads annotation names without requesting experiment metrics", async () => {
    const requestedOperations: {
      name: string;
      text: string | null | undefined;
    }[] = [];
    const environment = new Environment({
      network: Network.create((operation) => {
        requestedOperations.push({
          name: operation.name,
          text: operation.text,
        });
        return Observable.create(() => undefined);
      }),
      store: new Store(new RecordSource()),
    });

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>loading annotation names</div>}>
            <AnnotationNamesConsumer datasetId="dataset-1" />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    expect(requestedOperations).toHaveLength(1);
    expect(requestedOperations[0]?.name).toBe(
      "useExperimentAnnotationMetricNamesQuery"
    );
    expect(requestedOperations[0]?.text).toContain(
      "experimentAnnotationSummaries"
    );
    expect(requestedOperations[0]?.text).not.toContain("meanScore");
    expect(requestedOperations[0]?.text).not.toContain("labelFractions");
    expect(requestedOperations[0]?.text).not.toContain("metricsExperiments");
  });
});

function AnnotationNamesConsumer({ datasetId }: { datasetId: string }) {
  useExperimentAnnotationMetricNames(datasetId);
  return <div>annotation names</div>;
}
