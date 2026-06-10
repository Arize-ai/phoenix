import {
  parseAddDatasetExamplesInput,
  parseDeleteDatasetExamplesInput,
  parseListDatasetExamplesInput,
  parsePatchDatasetExamplesInput,
} from "../index";

describe("patch_dataset_examples input parser", () => {
  it("parses patches that change at least one field", () => {
    expect(
      parsePatchDatasetExamplesInput({
        patches: [{ exampleId: "E1", output: { a: 1 } }],
        versionDescription: "fix",
      })
    ).toEqual({
      patches: [{ exampleId: "E1", output: { a: 1 } }],
      versionDescription: "fix",
    });
  });

  it("rejects a patch with no changed field or empty patches", () => {
    expect(
      parsePatchDatasetExamplesInput({ patches: [{ exampleId: "E1" }] })
    ).toBeNull();
    expect(parsePatchDatasetExamplesInput({ patches: [] })).toBeNull();
    expect(parsePatchDatasetExamplesInput({})).toBeNull();
  });

  it("rejects duplicate exampleIds (two patches for one row cannot merge)", () => {
    expect(
      parsePatchDatasetExamplesInput({
        patches: [
          { exampleId: "E1", output: { a: 1 } },
          { exampleId: "E1", output: { a: 2 } },
        ],
      })
    ).toBeNull();
  });
});

describe("delete_dataset_examples input parser", () => {
  it("parses example ids", () => {
    expect(
      parseDeleteDatasetExamplesInput({ exampleIds: ["E1", "E2"] })
    ).toEqual({ exampleIds: ["E1", "E2"] });
  });

  it("deduplicates repeated ids (a duplicated delete errors server-side)", () => {
    expect(
      parseDeleteDatasetExamplesInput({ exampleIds: ["E1", "E2", "E1"] })
    ).toEqual({ exampleIds: ["E1", "E2"] });
  });

  it("requires at least one id", () => {
    expect(parseDeleteDatasetExamplesInput({ exampleIds: [] })).toBeNull();
    expect(parseDeleteDatasetExamplesInput({})).toBeNull();
  });
});

describe("add_dataset_examples input parser", () => {
  it("parses a valid examples array", () => {
    const result = parseAddDatasetExamplesInput({
      examples: [{ input: { q: "x" }, output: { a: "y" }, metadata: { k: 1 } }],
    });
    expect(result).not.toBeNull();
    expect(result?.examples).toHaveLength(1);
    expect(result?.examples[0].input).toEqual({ q: "x" });
    expect(result?.examples[0].output).toEqual({ a: "y" });
  });

  it("allows omitting output and metadata (input-only row)", () => {
    const result = parseAddDatasetExamplesInput({
      examples: [{ input: { q: "x" } }],
    });
    expect(result?.examples[0].output).toBeUndefined();
    expect(result?.examples[0].metadata).toBeUndefined();
  });

  it("rejects an empty examples array", () => {
    expect(parseAddDatasetExamplesInput({ examples: [] })).toBeNull();
  });

  it("rejects an example missing its input", () => {
    expect(
      parseAddDatasetExamplesInput({ examples: [{ output: {} }] })
    ).toBeNull();
  });

  it("rejects non-object input and malformed payloads", () => {
    expect(
      parseAddDatasetExamplesInput({ examples: [{ input: "nope" }] })
    ).toBeNull();
    expect(parseAddDatasetExamplesInput(null)).toBeNull();
    expect(parseAddDatasetExamplesInput({})).toBeNull();
  });
});

describe("list_dataset_examples input parser", () => {
  it("accepts an empty input (dataset comes from context)", () => {
    expect(parseListDatasetExamplesInput({})).toEqual({});
  });

  it("accepts a limit, cursor, and split filters", () => {
    expect(
      parseListDatasetExamplesInput({
        limit: 5,
        after: "Y3Vyc29y",
        splitNames: ["train", "test"],
      })
    ).toEqual({ limit: 5, after: "Y3Vyc29y", splitNames: ["train", "test"] });
  });

  it("rejects an out-of-range or non-integer limit", () => {
    expect(parseListDatasetExamplesInput({ limit: 0 })).toBeNull();
    expect(parseListDatasetExamplesInput({ limit: 9999 })).toBeNull();
    expect(parseListDatasetExamplesInput({ limit: 1.5 })).toBeNull();
    expect(parseListDatasetExamplesInput({ limit: "5" })).toBeNull();
  });

  it("rejects malformed split filters", () => {
    expect(parseListDatasetExamplesInput({ splitNames: "train" })).toBeNull();
    expect(parseListDatasetExamplesInput({ splitNames: [""] })).toBeNull();
  });
});
