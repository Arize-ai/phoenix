import { commitLocalUpdate } from "react-relay";

import { installTestStorage } from "@phoenix/__tests__/installTestStorage";
import RelayEnvironment from "@phoenix/RelayEnvironment";

import { createDatasetStore } from "../datasetStore";

const { fetchDataset } = vi.hoisted(() => ({ fetchDataset: vi.fn() }));

vi.mock("@phoenix/RelayEnvironment", async () => {
  const { Environment, Network, RecordSource, Store } =
    await import("relay-runtime");
  return {
    default: new Environment({
      network: Network.create(fetchDataset),
      store: new Store(new RecordSource()),
    }),
  };
});

installTestStorage();

const DATASET_ID = "RGF0YXNldDox";
const LATEST_VERSION = {
  id: "RGF0YXNldFZlcnNpb246Mg==",
  description: "Updated examples",
  createdAt: "2026-01-01T00:00:00Z",
};

const createStore = (previousCount: number, exampleCount: number) => {
  commitLocalUpdate(RelayEnvironment, (store) => {
    const dataset =
      store.get(DATASET_ID) ?? store.create(DATASET_ID, "Dataset");
    dataset.setValue(previousCount, "exampleCount");
  });
  fetchDataset.mockResolvedValue({
    data: {
      dataset: {
        __typename: "Dataset",
        id: DATASET_ID,
        exampleCount,
        labels: [],
        splits: [],
        latestVersions: {
          edges: [
            { version: { __typename: "DatasetVersion", ...LATEST_VERSION } },
          ],
        },
      },
    },
  });
  return createDatasetStore({
    datasetId: DATASET_ID,
    datasetName: "test dataset",
    latestVersion: null,
  });
};

const getCount = () =>
  RelayEnvironment.getStore().getSource().get(DATASET_ID)?.exampleCount;

describe("datasetStore refresh", () => {
  beforeEach(() => {
    localStorage.clear();
    fetchDataset.mockClear();
  });

  it.each([
    [0, 1],
    [1, 2],
    [2, 1],
    [1, 0],
  ])(
    "refreshes the latest version and count from %i to %i",
    async (previous, next) => {
      const store = createStore(previous, next);
      await store.getState().refreshLatestVersion();
      expect(store.getState().latestVersion).toEqual(LATEST_VERSION);
      expect(getCount()).toBe(next);
      expect(fetchDataset).toHaveBeenCalledTimes(1);
    }
  );

  it("refreshes the count through the summary action", async () => {
    await createStore(1, 2).getState().refreshSummary();
    expect(getCount()).toBe(2);
  });
});
