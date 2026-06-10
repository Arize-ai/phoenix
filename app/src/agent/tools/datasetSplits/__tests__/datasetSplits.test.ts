import {
  parseCreateDatasetSplitInput,
  parseDeleteDatasetSplitsInput,
  parseListDatasetSplitsInput,
  parseListSplitsInput,
  parsePatchDatasetSplitInput,
  parseSetDatasetExampleSplitsInput,
} from "../index";

describe("patch_dataset_split input parser", () => {
  it("parses a split name plus a changed field", () => {
    expect(
      parsePatchDatasetSplitInput({ splitName: "test", name: "holdout" })
    ).toEqual({ splitName: "test", name: "holdout" });
  });

  it("rejects when nothing changes or the split name is missing", () => {
    expect(parsePatchDatasetSplitInput({ splitName: "test" })).toBeNull();
    expect(parsePatchDatasetSplitInput({ name: "x" })).toBeNull();
  });

  it("passes null description through as a clear", () => {
    expect(
      parsePatchDatasetSplitInput({ splitName: "test", description: null })
    ).toEqual({ splitName: "test", description: null });
  });

  it("treats null name/color as omitted (they cannot be cleared)", () => {
    // Null alongside a real change: the nulls are dropped, the change survives.
    expect(
      parsePatchDatasetSplitInput({
        splitName: "test",
        name: "holdout",
        color: null,
      })
    ).toEqual({ splitName: "test", name: "holdout" });
    // Non-clearable nulls only: nothing would change, so the call is rejected
    // instead of being approved and reporting a success that does nothing.
    expect(
      parsePatchDatasetSplitInput({
        splitName: "test",
        name: null,
        color: null,
      })
    ).toBeNull();
  });

  it("rejects empty strings (a silent no-op on the backend)", () => {
    expect(
      parsePatchDatasetSplitInput({ splitName: "test", description: "" })
    ).toBeNull();
    expect(
      parsePatchDatasetSplitInput({ splitName: "test", name: "" })
    ).toBeNull();
  });
});

describe("delete_dataset_splits input parser", () => {
  it("parses split names", () => {
    expect(parseDeleteDatasetSplitsInput({ splitNames: ["test"] })).toEqual({
      splitNames: ["test"],
    });
  });

  it("requires at least one name", () => {
    expect(parseDeleteDatasetSplitsInput({ splitNames: [] })).toBeNull();
  });
});

describe("list_dataset_splits input parser", () => {
  it("accepts empty input (dataset comes from context)", () => {
    expect(parseListDatasetSplitsInput({})).toEqual({});
    expect(parseListDatasetSplitsInput({ ignored: 1 })).toEqual({});
  });

  it("rejects non-object input", () => {
    expect(parseListDatasetSplitsInput(null)).toBeNull();
    expect(parseListDatasetSplitsInput("nope")).toBeNull();
  });
});

describe("list_splits input parser", () => {
  it("accepts empty input", () => {
    expect(parseListSplitsInput({})).toEqual({});
  });

  it("accepts a limit and pagination cursor", () => {
    expect(parseListSplitsInput({ limit: 25, after: "Y3Vyc29y" })).toEqual({
      limit: 25,
      after: "Y3Vyc29y",
    });
  });

  it("rejects an out-of-range limit", () => {
    expect(parseListSplitsInput({ limit: 0 })).toBeNull();
    expect(parseListSplitsInput({ limit: 9999 })).toBeNull();
  });
});

describe("create_dataset_split input parser", () => {
  it("parses a name with optional fields and seed ids", () => {
    expect(
      parseCreateDatasetSplitInput({
        name: "hard",
        description: "tricky rows",
        color: "#ff0000",
        exampleIds: ["E1", "E2"],
      })
    ).toEqual({
      name: "hard",
      description: "tricky rows",
      color: "#ff0000",
      exampleIds: ["E1", "E2"],
    });
  });

  it("accepts a bare name", () => {
    expect(parseCreateDatasetSplitInput({ name: "test" })).toEqual({
      name: "test",
    });
  });

  it("rejects a missing/empty name", () => {
    expect(parseCreateDatasetSplitInput({ name: "" })).toBeNull();
    expect(parseCreateDatasetSplitInput({})).toBeNull();
  });
});

describe("set_dataset_example_splits input parser", () => {
  it("parses example ids and split names", () => {
    expect(
      parseSetDatasetExampleSplitsInput({
        exampleIds: ["E1", "E2"],
        splitNames: ["test"],
      })
    ).toEqual({ exampleIds: ["E1", "E2"], splitNames: ["test"] });
  });

  it("requires at least one example and one split", () => {
    expect(
      parseSetDatasetExampleSplitsInput({
        exampleIds: [],
        splitNames: ["test"],
      })
    ).toBeNull();
    expect(
      parseSetDatasetExampleSplitsInput({ exampleIds: ["E1"], splitNames: [] })
    ).toBeNull();
    expect(parseSetDatasetExampleSplitsInput({})).toBeNull();
  });
});
