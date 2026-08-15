import { parsePathSegments } from "@phoenix/utils/objectUtils";

import { appendPathSegment } from "../EvaluatorEntityTree";

describe("appendPathSegment", () => {
  // What the tree emits is what the server parses, so the keys have to survive
  // the round trip — attribute keys carry dots of their own.
  it("emits paths that resolve back to the keys they were built from", () => {
    const path = ["attributes", "llm.model_name"].reduce(
      (parent, key) => appendPathSegment(parent, key, false),
      "span"
    );

    expect(path).toBe("span.attributes['llm.model_name']");
    expect(parsePathSegments(path)).toEqual([
      "span",
      "attributes",
      "llm.model_name",
    ]);
  });

  it("indexes into a list with bracket notation", () => {
    const path = appendPathSegment(
      appendPathSegment("session", "turns", false),
      "0",
      true
    );

    expect(path).toBe("session.turns[0]");
    expect(parsePathSegments(path)).toEqual(["session", "turns", "0"]);
  });
});
