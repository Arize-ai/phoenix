import { normalizeInputMapping } from "../inputMappingUtils";

describe("normalizeInputMapping", () => {
  it("removes paths shadowed by literal values without changing the input", () => {
    const mapping = {
      pathMapping: {
        text: "input.text",
        enabled: "input.enabled",
        count: "input.count",
        empty: "input.empty",
        pathOnly: "input.pathOnly",
      },
      literalMapping: { text: "foo", enabled: false, count: 0, empty: "" },
    };

    expect(normalizeInputMapping(mapping)).toEqual({
      pathMapping: { empty: "input.empty", pathOnly: "input.pathOnly" },
      literalMapping: mapping.literalMapping,
    });
    expect(mapping.pathMapping).toHaveProperty("text", "input.text");
  });
});
