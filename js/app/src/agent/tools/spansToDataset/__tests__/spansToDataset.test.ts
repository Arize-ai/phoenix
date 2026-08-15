import { parseAddSpansToDatasetInput } from "../index";

describe("add_spans_to_dataset input parser", () => {
  it("accepts a dataset name (span comes from context)", () => {
    expect(parseAddSpansToDatasetInput({ datasetName: "regression" })).toEqual({
      datasetName: "regression",
    });
  });

  it("accepts explicit span ids", () => {
    expect(
      parseAddSpansToDatasetInput({
        datasetName: "regression",
        spanIds: ["S1", "S2"],
      })
    ).toEqual({ datasetName: "regression", spanIds: ["S1", "S2"] });
  });

  it("rejects a missing/empty dataset name", () => {
    expect(parseAddSpansToDatasetInput({ datasetName: "" })).toBeNull();
    expect(parseAddSpansToDatasetInput({})).toBeNull();
    expect(parseAddSpansToDatasetInput({ spanIds: ["S1"] })).toBeNull();
  });
});
