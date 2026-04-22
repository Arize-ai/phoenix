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
      const { datasetId } = variables as { datasetId: string };

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

  it("updates when the owned query ref changes and disposes replaced refs", async () => {
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

    const firstDisposeSpy = vi.spyOn(firstQueryRef, "dispose");
    const secondDisposeSpy = vi.spyOn(secondQueryRef, "dispose");

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>Loading...</div>}>
            <QueryReader queryRef={firstQueryRef} />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    expect(container.textContent).toBe("dataset-1:version-dataset-1");
    expect(firstDisposeSpy).not.toHaveBeenCalled();
    expect(secondDisposeSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>Loading...</div>}>
            <QueryReader queryRef={secondQueryRef} />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });

    // If this ever stops updating, it means our hook is no longer adopting a
    // replacement query ref from the caller.
    expect(container.textContent).toBe("dataset-2:version-dataset-2");
    // When ownership moves to the new ref, the old one must be disposed to
    // avoid retaining unused data indefinitely.
    expect(firstDisposeSpy).toHaveBeenCalledTimes(1);
    expect(secondDisposeSpy).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    isUnmounted = true;

    // The currently owned ref should also be released when the component
    // unmounts, matching the manual ownership contract this hook exists for.
    expect(secondDisposeSpy).toHaveBeenCalledTimes(1);
  });
});
