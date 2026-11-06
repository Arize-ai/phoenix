import {
  buildDatasetSelectionSnapshot,
  buildSelectionRevision,
  parseLoadDatasetInput,
} from "@phoenix/agent/tools/playgroundLoadDataset";
import { _resetInstanceId, _resetMessageId } from "@phoenix/store/playground";

describe("playground load dataset agent tool", () => {
  beforeEach(() => {
    _resetInstanceId();
    _resetMessageId();
    vi.clearAllMocks();
  });

  it("parses common load_dataset input aliases", () => {
    expect(
      parseLoadDatasetInput({
        dataset_name: "Support Tickets",
        split_name: "train",
      })
    ).toEqual({ datasetName: "Support Tickets", splitName: "train" });
  });

  it("requires a non-empty dataset name", () => {
    expect(parseLoadDatasetInput({})).toBeNull();
    expect(parseLoadDatasetInput({ datasetName: "   " })).toBeNull();
  });

  it("treats a null split name as loading the whole dataset", () => {
    expect(
      parseLoadDatasetInput({ datasetName: "Support", splitName: null })
    ).toEqual({ datasetName: "Support" });
  });

  it("derives a revision independent of split ordering", () => {
    expect(
      buildSelectionRevision({ datasetId: "d1", splitIds: ["a", "b"] })
    ).toEqual(
      buildSelectionRevision({ datasetId: "d1", splitIds: ["b", "a"] })
    );
    expect(
      buildSelectionRevision({ datasetId: "d1", splitIds: ["a"] })
    ).not.toEqual(buildSelectionRevision({ datasetId: "d2", splitIds: ["a"] }));
  });

  it("snapshots only the selected split id and names", () => {
    expect(
      buildDatasetSelectionSnapshot({
        datasetId: "d1",
        datasetName: "Support",
        splitId: "s1",
        splitName: "train",
      })
    ).toEqual({
      datasetId: "d1",
      splitIds: ["s1"],
      datasetName: "Support",
      splitNames: ["train"],
    });
    expect(
      buildDatasetSelectionSnapshot({
        datasetId: "d1",
        datasetName: "Support",
        splitId: null,
        splitName: null,
      })
    ).toEqual({ datasetId: "d1", splitIds: [], datasetName: "Support" });
  });
});
