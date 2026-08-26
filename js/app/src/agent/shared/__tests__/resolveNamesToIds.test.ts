import { resolveNamesToIds } from "../resolveNamesToIds";

const items = [
  { id: "S1", name: "Train" },
  { id: "S2", name: "Test" },
];

describe("resolveNamesToIds", () => {
  it("resolves exact names to ids, in input order", () => {
    expect(resolveNamesToIds(items, ["Test", "Train"])).toEqual({
      ids: ["S2", "S1"],
      unknown: [],
    });
  });

  it("matches case-sensitively (a different case is unknown, not a match)", () => {
    expect(resolveNamesToIds(items, ["train", "TEST"])).toEqual({
      ids: [],
      unknown: ["train", "TEST"],
    });
  });

  it("resolves case-variant names to their own distinct ids", () => {
    const items = [
      { id: "A", name: "Train" },
      { id: "B", name: "train" },
    ];
    expect(resolveNamesToIds(items, ["train"])).toEqual({
      ids: ["B"],
      unknown: [],
    });
  });

  it("collects unknown names without throwing", () => {
    expect(resolveNamesToIds(items, ["Train", "nope"])).toEqual({
      ids: ["S1"],
      unknown: ["nope"],
    });
  });

  it("handles empty inputs", () => {
    expect(resolveNamesToIds([], ["x"])).toEqual({ ids: [], unknown: ["x"] });
    expect(resolveNamesToIds(items, [])).toEqual({ ids: [], unknown: [] });
  });
});
