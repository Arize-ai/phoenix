import {
  describeEvaluatorPathFanOut,
  describeEvaluatorPathWildcardLevel,
} from "../evaluatorPathWords";

describe("describeEvaluatorPathFanOut", () => {
  it("says which items a wildcard or slice keeps in its list", () => {
    const listOf = (path: string) =>
      describeEvaluatorPathFanOut({ path, matchCount: 3 });

    expect(listOf("input.messages[*]")).toBe("A list of every message");
    expect(listOf("metadata.turns[:-1]")).toBe(
      "A list of every turn but the last"
    );
    expect(listOf("metadata.turns[:-2]")).toBe(
      "A list of every turn but the last 2"
    );
    expect(listOf("metadata.turns[1:]")).toBe(
      "A list of every turn but the first"
    );
  });

  it("counts a selection that has no plainer name", () => {
    expect(
      describeEvaluatorPathFanOut({
        path: "input.messages[0,2]",
        matchCount: 2,
      })
    ).toBe("A list of 2 messages");
  });

  it("says a field read through a wildcard is a list of each item's value", () => {
    expect(
      describeEvaluatorPathFanOut({
        path: "output.documents[*].content",
        matchCount: 2,
      })
    ).toBe("A list of each document's value");
  });

  it("counts a single match without calling it a list", () => {
    expect(
      describeEvaluatorPathFanOut({
        path: "metadata.turns[:-1]",
        matchCount: 1,
      })
    ).toBe("1 turn");
    expect(
      describeEvaluatorPathFanOut({
        path: "input.messages[*].content",
        matchCount: 1,
      })
    ).toBe("1 value");
  });

  it("calls an object wildcard's values its fields", () => {
    expect(
      describeEvaluatorPathFanOut({ path: "metadata.*", matchCount: 4 })
    ).toBe("A list of every field");
  });

  it("says nothing about a path that reads one value", () => {
    expect(
      describeEvaluatorPathFanOut({ path: "input.messages[-1]", matchCount: 1 })
    ).toBeNull();
  });
});

describe("describeEvaluatorPathWildcardLevel", () => {
  it("heads a wildcard's level by the item it repeats over", () => {
    expect(describeEvaluatorPathWildcardLevel("input.messages[*]")).toBe(
      "Each message in input.messages"
    );
  });

  it("leaves any other level to be headed by its path", () => {
    expect(describeEvaluatorPathWildcardLevel("input.messages[-1]")).toBeNull();
    expect(describeEvaluatorPathWildcardLevel("input.messages")).toBeNull();
  });
});
