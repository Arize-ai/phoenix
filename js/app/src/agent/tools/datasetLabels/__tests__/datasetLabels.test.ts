import {
  parseCreateDatasetLabelInput,
  parseDeleteDatasetLabelsInput,
  parseListDatasetLabelsInput,
  parseListLabelsInput,
  parseSetDatasetLabelsInput,
} from "../index";

describe("delete_dataset_labels input parser", () => {
  it("parses label names", () => {
    expect(parseDeleteDatasetLabelsInput({ labelNames: ["prod"] })).toEqual({
      labelNames: ["prod"],
    });
  });

  it("requires at least one name", () => {
    expect(parseDeleteDatasetLabelsInput({ labelNames: [] })).toBeNull();
    expect(parseDeleteDatasetLabelsInput({})).toBeNull();
  });
});

describe("list_dataset_labels input parser", () => {
  it("accepts empty input (dataset comes from context)", () => {
    expect(parseListDatasetLabelsInput({})).toEqual({});
    expect(parseListDatasetLabelsInput({ ignored: 1 })).toEqual({});
  });

  it("rejects non-object input", () => {
    expect(parseListDatasetLabelsInput(null)).toBeNull();
  });
});

describe("list_labels input parser", () => {
  it("accepts empty input", () => {
    expect(parseListLabelsInput({})).toEqual({});
  });

  it("accepts a limit and pagination cursor", () => {
    expect(parseListLabelsInput({ limit: 25, after: "Y3Vyc29y" })).toEqual({
      limit: 25,
      after: "Y3Vyc29y",
    });
  });

  it("rejects an out-of-range limit", () => {
    expect(parseListLabelsInput({ limit: 0 })).toBeNull();
    expect(parseListLabelsInput({ limit: 9999 })).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseListLabelsInput(null)).toBeNull();
  });
});

describe("create_dataset_label input parser", () => {
  it("parses a name with optional fields", () => {
    expect(
      parseCreateDatasetLabelInput({
        name: "prod",
        description: "production datasets",
        color: "#ff0000",
        attachToDataset: false,
      })
    ).toEqual({
      name: "prod",
      description: "production datasets",
      color: "#ff0000",
      attachToDataset: false,
    });
  });

  it("accepts a bare name", () => {
    expect(parseCreateDatasetLabelInput({ name: "prod" })).toEqual({
      name: "prod",
    });
  });

  it("rejects a missing/empty name", () => {
    expect(parseCreateDatasetLabelInput({ name: "" })).toBeNull();
    expect(parseCreateDatasetLabelInput({})).toBeNull();
  });
});

describe("set_dataset_labels input parser", () => {
  it("parses label names", () => {
    expect(
      parseSetDatasetLabelsInput({ labelNames: ["prod", "golden"] })
    ).toEqual({ labelNames: ["prod", "golden"] });
  });

  it("requires at least one label", () => {
    expect(parseSetDatasetLabelsInput({ labelNames: [] })).toBeNull();
    expect(parseSetDatasetLabelsInput({})).toBeNull();
  });
});
