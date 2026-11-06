import { parseDeleteDatasetInput, parsePatchDatasetInput } from "../index";

describe("patch_dataset input parser", () => {
  it("accepts a single changed field", () => {
    expect(parsePatchDatasetInput({ name: "renamed" })).toEqual({
      name: "renamed",
    });
    expect(parsePatchDatasetInput({ description: "new desc" })).toEqual({
      description: "new desc",
    });
    expect(parsePatchDatasetInput({ metadata: { a: 1 } })).toEqual({
      metadata: { a: 1 },
    });
  });

  it("rejects an empty patch (nothing to change)", () => {
    expect(parsePatchDatasetInput({})).toBeNull();
    expect(parsePatchDatasetInput({ name: "" })).toBeNull();
  });
});

describe("delete_dataset input parser", () => {
  it("accepts empty input (operates on the in-context dataset)", () => {
    expect(parseDeleteDatasetInput({})).toEqual({});
  });

  it("rejects non-object input", () => {
    expect(parseDeleteDatasetInput(null)).toBeNull();
  });
});
