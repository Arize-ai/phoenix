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

import { DatasetSelectWithSplits } from "../DatasetSelectWithSplits";

function datasetNode(id: string, name: string) {
  return {
    id,
    name,
    exampleCount: 20,
    splits: [],
    labels: [],
  };
}

function datasetsResponse(nodes: ReturnType<typeof datasetNode>[]) {
  return {
    data: {
      datasets: {
        edges: nodes.map((node) => ({
          cursor: node.id,
          dataset: { __typename: "Dataset", ...node },
          node: { __typename: "Dataset", ...node },
        })),
        pageInfo: { endCursor: null, hasNextPage: false },
      },
    },
  };
}

function createEnvironment(
  responses: ReturnType<typeof datasetsResponse>[],
  requests: string[]
) {
  return new Environment({
    network: Network.create((operation) => {
      requests.push(operation.name);
      const response =
        responses[Math.min(requests.length - 1, responses.length - 1)];
      return Observable.from(Promise.resolve(response));
    }),
    store: new Store(new RecordSource()),
  });
}

describe("DatasetSelectWithSplits", () => {
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

  async function render(environment: Environment, datasetId: string) {
    await act(async () => {
      root.render(
        <RelayEnvironmentProvider environment={environment}>
          <Suspense fallback={<div>loading</div>}>
            <DatasetSelectWithSplits
              value={{ datasetId, splitIds: [] }}
              onSelectionChange={() => {}}
            />
          </Suspense>
        </RelayEnvironmentProvider>
      );
    });
    // let the refetch triggered by the effect resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("refetches the dataset list when the selected dataset is not in it", async () => {
    const requests: string[] = [];
    const environment = createEnvironment(
      [
        datasetsResponse([datasetNode("existing", "existing dataset")]),
        datasetsResponse([
          datasetNode("new", "agent created dataset"),
          datasetNode("existing", "existing dataset"),
        ]),
      ],
      requests
    );

    await render(environment, "new");

    expect(requests).toEqual([
      "DatasetSelectWithSplitsQuery",
      "DatasetSelectWithSplitsQuery",
    ]);
    expect(container.textContent).toContain("agent created dataset");
  });

  it("does not refetch when the selected dataset is already listed", async () => {
    const requests: string[] = [];
    const environment = createEnvironment(
      [datasetsResponse([datasetNode("existing", "existing dataset")])],
      requests
    );

    await render(environment, "existing");

    expect(requests).toEqual(["DatasetSelectWithSplitsQuery"]);
    expect(container.textContent).toContain("existing dataset");
  });

  it("refetches only once for a dataset id that never shows up", async () => {
    const requests: string[] = [];
    const environment = createEnvironment(
      [datasetsResponse([datasetNode("existing", "existing dataset")])],
      requests
    );

    await render(environment, "missing");

    expect(requests).toHaveLength(2);
  });
});
