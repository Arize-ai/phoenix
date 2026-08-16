import { parseListDatasetsInput } from "../index";

describe("list_datasets input parser", () => {
  it("accepts an empty input (list all)", () => {
    expect(parseListDatasetsInput({})).toEqual({});
  });

  it("accepts a name filter, limit, and cursor", () => {
    expect(
      parseListDatasetsInput({
        nameContains: "regression",
        limit: 10,
        after: "Y3Vyc29y",
      })
    ).toEqual({ nameContains: "regression", limit: 10, after: "Y3Vyc29y" });
  });

  it("trims the name filter", () => {
    expect(
      parseListDatasetsInput({ nameContains: "  eval  " })?.nameContains
    ).toBe("eval");
  });

  it("rejects an out-of-range or non-integer limit", () => {
    expect(parseListDatasetsInput({ limit: 0 })).toBeNull();
    expect(parseListDatasetsInput({ limit: 9999 })).toBeNull();
    expect(parseListDatasetsInput({ limit: 2.5 })).toBeNull();
  });

  it("rejects malformed payloads", () => {
    expect(parseListDatasetsInput({ nameContains: "" })).toBeNull();
    expect(parseListDatasetsInput(null)).toBeNull();
    expect(parseListDatasetsInput({ nameContains: 5 })).toBeNull();
  });
});
