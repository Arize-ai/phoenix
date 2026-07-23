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
  useExperimentAnnotationMetricData,
  useExperimentAnnotationMetricNames,
} from "../useExperimentAnnotationMetricsData";

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

  it("observes baseline replacements and clears through the Dataset link", async () => {
    const environment = new Environment({
      network: Network.create(() =>
        Promise.resolve({
          data: {
            dataset: {
              __typename: "Dataset",
              id: "dataset-1",
              baselineExperiment: makeExperiment({
                id: "experiment-1",
                name: "first",
                sequenceNumber: 1,
                isBaseline: true,
              }),
              metricsExperiments: {
                edges: [
                  {
                    experiment: makeExperiment({
                      id: "experiment-1",
                      name: "first",
                      sequenceNumber: 1,
                      isBaseline: true,
                    }),
                  },
                  {
                    experiment: makeExperiment({
                      id: "experiment-2",
                      name: "second",
                      sequenceNumber: 2,
                      isBaseline: false,
                    }),
                  },
                ],
              },
            },
          },
        })
      ),
      store: new Store(new RecordSource()),
    });

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>loading annotation metrics</div>}>
            <AnnotationMetricsConsumer datasetId="dataset-1" />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });
    expect(container.textContent).toBe(
      "baseline=experiment-1; experiments=experiment-1:true,experiment-2:false"
    );

    act(() => {
      environment.commitUpdate((store) => {
        const dataset = store.get("dataset-1");
        const previousBaseline = store.get("experiment-1");
        const nextBaseline = store.get("experiment-2");
        previousBaseline?.setValue(false, "isBaseline");
        nextBaseline?.setValue(true, "isBaseline");
        dataset?.setLinkedRecord(nextBaseline ?? null, "baselineExperiment");
      });
    });
    expect(container.textContent).toBe(
      "baseline=experiment-2; experiments=experiment-1:false,experiment-2:true"
    );

    act(() => {
      environment.commitUpdate((store) => {
        store.get("experiment-2")?.setValue(false, "isBaseline");
        store.get("dataset-1")?.setValue(null, "baselineExperiment");
      });
    });
    expect(container.textContent).toBe(
      "baseline=none; experiments=experiment-1:false,experiment-2:false"
    );
  });
});

function AnnotationNamesConsumer({ datasetId }: { datasetId: string }) {
  useExperimentAnnotationMetricNames(datasetId);
  return <div>annotation names</div>;
}

function AnnotationMetricsConsumer({ datasetId }: { datasetId: string }) {
  const { baselineExperiment, experiments } = useExperimentAnnotationMetricData(
    {
      datasetId,
      annotationName: "quality",
    }
  );
  return (
    <div>
      baseline={baselineExperiment?.id ?? "none"}; experiments=
      {experiments
        .map(({ id, isBaseline }) => `${id}:${String(isBaseline)}`)
        .join(",")}
    </div>
  );
}

function makeExperiment({
  id,
  name,
  sequenceNumber,
  isBaseline,
}: {
  id: string;
  name: string;
  sequenceNumber: number;
  isBaseline: boolean;
}) {
  return {
    id,
    name,
    sequenceNumber,
    isBaseline,
    annotationSummaries: [
      {
        annotationName: "quality",
        meanScore: 0.5,
        labelFractions: [],
      },
    ],
  };
}
