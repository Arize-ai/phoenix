import { act, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RelayEnvironmentProvider, loadQuery } from "react-relay";
import {
  Environment,
  Network,
  Observable,
  RecordSource,
  Store,
} from "relay-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { datasetStore_latestVersionQuery } from "../../store/__generated__/datasetStore_latestVersionQuery.graphql";
import datasetStoreLatestVersionQueryNode from "../../store/__generated__/datasetStore_latestVersionQuery.graphql";
import {
  useOwnedPreloadedQuery,
  type OwnedPreloadedQueryRef,
} from "../useOwnedPreloadedQuery";

function createTestEnvironment() {
  return new Environment({
    network: Network.create((_operation, variables) => {
      const datasetId = String(variables.datasetId);

      return Observable.create((sink) => {
        // Return a distinct payload per query ref so the test can prove that
        // rerendering with a new externally owned ref updates the UI.
        sink.next({
          data: {
            dataset: {
              __typename: "Dataset",
              id: datasetId,
              latestVersions: {
                edges: [
                  {
                    version: {
                      id: `version-${datasetId}`,
                      description: `Description for ${datasetId}`,
                      createdAt: "2026-01-01T00:00:00Z",
                    },
                  },
                ],
              },
            },
          },
        });
        sink.complete();
      });
    }),
    store: new Store(new RecordSource()),
  });
}

function loadDatasetQueryRef({
  environment,
  datasetId,
}: {
  environment: Environment;
  datasetId: string;
}) {
  return loadQuery<datasetStore_latestVersionQuery>(
    environment,
    datasetStoreLatestVersionQueryNode,
    { datasetId },
    { fetchPolicy: "network-only" }
  );
}

function spyOnReleaseQuery(queryRef: ReturnType<typeof loadDatasetQueryRef>) {
  return vi.spyOn(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- spy on the internal releaseQuery not present on the public PreloadedQuery type
    queryRef as typeof queryRef & { releaseQuery: () => void },
    "releaseQuery"
  );
}

function QueryReader({
  queryRef,
}: {
  queryRef: OwnedPreloadedQueryRef<datasetStore_latestVersionQuery>;
}) {
  // This mirrors the real route-loader pattern we care about: the component
  // receives a preloaded query ref it did not create, then assumes ownership
  // through useOwnedPreloadedQuery.
  const data = useOwnedPreloadedQuery<datasetStore_latestVersionQuery>({
    query: datasetStoreLatestVersionQueryNode,
    queryRef,
  });

  const latestVersionId =
    data.dataset.latestVersions?.edges[0]?.version.id ?? "no-version";

  return (
    <div data-testid="result">
      {data.dataset.id}:{latestVersionId}
    </div>
  );
}

function DirectReturnLoaderReader({
  loaderData,
}: {
  loaderData: OwnedPreloadedQueryRef<datasetStore_latestVersionQuery>;
}) {
  return <QueryReader queryRef={loaderData} />;
}

function ObjectWrappedLoaderReader({
  loaderData,
}: {
  loaderData: {
    queryRef: OwnedPreloadedQueryRef<datasetStore_latestVersionQuery>;
  };
}) {
  return <QueryReader queryRef={loaderData.queryRef} />;
}

describe("useOwnedPreloadedQuery", () => {
  let container: HTMLDivElement;
  let root: Root;
  let isUnmounted: boolean;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    isUnmounted = false;
  });

  afterEach(() => {
    if (!isUnmounted) {
      act(() => {
        root.unmount();
      });
    }
    container.remove();
    vi.restoreAllMocks();
  });

  it("owns and disposes a direct-return loader query ref", async () => {
    const environment = createTestEnvironment();
    // We intentionally create two refs for the same query with different
    // variables. The regression we want to catch is "initial ref works, but a
    // later ref passed on rerender is ignored or the old ref is leaked".
    const firstQueryRef = loadDatasetQueryRef({
      environment,
      datasetId: "dataset-1",
    });
    const secondQueryRef = loadDatasetQueryRef({
      environment,
      datasetId: "dataset-2",
    });

    const firstReleaseSpy = spyOnReleaseQuery(firstQueryRef);
    const secondReleaseSpy = spyOnReleaseQuery(secondQueryRef);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>Loading...</div>}>
            <DirectReturnLoaderReader loaderData={firstQueryRef} />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    expect(container.textContent).toBe("dataset-1:version-dataset-1");
    expect(firstReleaseSpy).not.toHaveBeenCalled();
    expect(secondReleaseSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>Loading...</div>}>
            <DirectReturnLoaderReader loaderData={secondQueryRef} />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    // If this ever stops updating, it means our hook is no longer adopting a
    // replacement query ref from the caller.
    expect(container.textContent).toBe("dataset-2:version-dataset-2");
    // When ownership moves to the new ref, the old one must be released to
    // avoid retaining unused data indefinitely.
    expect(firstReleaseSpy).toHaveBeenCalledTimes(1);
    expect(secondReleaseSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    isUnmounted = true;

    // The currently owned ref should also be released when the component
    // unmounts, matching the manual ownership contract this hook exists for.
    expect(secondReleaseSpy).toHaveBeenCalledTimes(1);
  });

  it("owns and disposes an object-wrapped loader query ref", async () => {
    const environment = createTestEnvironment();
    const firstQueryRef = loadDatasetQueryRef({
      environment,
      datasetId: "dataset-3",
    });
    const secondQueryRef = loadDatasetQueryRef({
      environment,
      datasetId: "dataset-4",
    });

    const firstReleaseSpy = spyOnReleaseQuery(firstQueryRef);
    const secondReleaseSpy = spyOnReleaseQuery(secondQueryRef);

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>Loading...</div>}>
            <ObjectWrappedLoaderReader
              loaderData={{ queryRef: firstQueryRef }}
            />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    expect(container.textContent).toBe("dataset-3:version-dataset-3");
    expect(firstReleaseSpy).not.toHaveBeenCalled();
    expect(secondReleaseSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>Loading...</div>}>
            <ObjectWrappedLoaderReader
              loaderData={{ queryRef: secondQueryRef }}
            />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    expect(container.textContent).toBe("dataset-4:version-dataset-4");
    expect(firstReleaseSpy).toHaveBeenCalledTimes(1);
    expect(secondReleaseSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    isUnmounted = true;

    expect(secondReleaseSpy).toHaveBeenCalledTimes(1);
  });
});
