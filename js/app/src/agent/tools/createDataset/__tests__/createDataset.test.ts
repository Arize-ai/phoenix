import { parseCreateDatasetInput } from "../index";

describe("create_dataset input parser", () => {
  it("parses a name with optional description and seed examples", () => {
    const result = parseCreateDatasetInput({
      name: "my-dataset",
      description: "a test set",
      examples: [{ input: { q: "x" }, output: { a: "y" } }],
    });
    expect(result?.name).toBe("my-dataset");
    expect(result?.description).toBe("a test set");
    expect(result?.examples).toHaveLength(1);
  });

  it("parses a bare name (no description, no examples)", () => {
    const result = parseCreateDatasetInput({ name: "just-a-name" });
    expect(result).toEqual({ name: "just-a-name" });
  });

  it("trims the name", () => {
    expect(parseCreateDatasetInput({ name: "  spaced  " })?.name).toBe(
      "spaced"
    );
  });

  it("rejects a missing or empty name", () => {
    expect(parseCreateDatasetInput({ name: "" })).toBeNull();
    expect(parseCreateDatasetInput({ name: "   " })).toBeNull();
    expect(parseCreateDatasetInput({ examples: [] })).toBeNull();
    expect(parseCreateDatasetInput(null)).toBeNull();
  });

  it("rejects a seed example missing its input", () => {
    expect(
      parseCreateDatasetInput({ name: "x", examples: [{ output: {} }] })
    ).toBeNull();
  });
});
