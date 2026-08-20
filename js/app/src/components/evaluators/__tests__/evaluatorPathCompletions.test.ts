import { parsePathSegments } from "@phoenix/utils/objectUtils";

import {
  appendPathSegment,
  getEvaluatorPathCompletions,
  getEvaluatorPathCursor,
  MAX_BROWSE_MEMBERS,
  resolveEvaluatorPath,
} from "../evaluatorPathCompletions";

const SPAN_SOURCE: Record<string, unknown> = {
  input: "what is the weather?",
  output: "sunny",
  metadata: { attributes: { llm: { model_name: "gpt-4o-mini" } } },
  span: {
    span_id: "7f3b1c9a",
    input_value: "what is the weather?",
    attributes: {
      llm: { model_name: "gpt-4o-mini", token_count: { total: 100 } },
      "llm.deprecated": "legacy",
    },
    events: [{ name: "exception" }],
  },
};

const SESSION_SOURCE: Record<string, unknown> = {
  input: "transcript",
  output: "last response",
  metadata: { turns: [] },
  session: { session_id: "abc", turns: [{ input: "hi", output: "hello" }] },
};

const completionsFor = (
  textBeforeCursor: string,
  source = SPAN_SOURCE,
  rootToken = "span",
  suggestedPaths: readonly { path: string; description: string }[] = []
) =>
  getEvaluatorPathCompletions({
    source,
    rootToken,
    suggestedPaths,
    textBeforeCursor,
  });

describe("appendPathSegment", () => {
  // What the field writes is what the server parses, so the keys have to
  // survive the round trip — attribute keys carry dots of their own.
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

describe("getEvaluatorPathCursor", () => {
  it("treats a trailing name as still being typed", () => {
    expect(getEvaluatorPathCursor("span")).toEqual({
      containerPath: "",
      partial: "span",
      from: 0,
    });
  });

  it("opens the level below once the separator is typed", () => {
    expect(getEvaluatorPathCursor("span.attributes.")).toEqual({
      containerPath: "span.attributes",
      partial: "",
      from: 16,
    });
  });

  it("matches on the name alone inside an open subscript", () => {
    expect(getEvaluatorPathCursor("span.attributes['ll")).toEqual({
      containerPath: "span.attributes",
      partial: "ll",
      from: 17,
    });
  });

  it("drills past a list index", () => {
    expect(getEvaluatorPathCursor("session.turns[0].in")).toEqual({
      containerPath: "session.turns[0]",
      partial: "in",
      from: 17,
    });
  });
});

describe("getEvaluatorPathCompletions", () => {
  it("offers the record's own fields at the root, rooted at the record", () => {
    const result = completionsFor("");

    expect(result?.containerPath).toBe("span");
    expect(result?.completions.map((completion) => completion.key)).toEqual([
      "span_id",
      "input_value",
      "attributes",
      "events",
    ]);
    expect(result?.completions.map((completion) => completion.path)).toEqual([
      "span.span_id",
      "span.input_value",
      "span.attributes",
      "span.events",
    ]);
  });

  it("offers the next level's members after each separator", () => {
    const result = completionsFor("span.attributes.");

    expect(result?.from).toBe(16);
    expect(result?.containerPath).toBe("span.attributes");
    expect(result?.completions.map((completion) => completion.path)).toEqual([
      "span.attributes.llm",
      "span.attributes['llm.deprecated']",
    ]);
  });

  it("previews the value each member holds on the record", () => {
    const result = completionsFor("span.attributes.llm.");

    expect(
      result?.completions.map(({ key, preview }) => [key, preview])
    ).toEqual([
      ["model_name", "gpt-4o-mini"],
      ["token_count", "object"],
    ]);
  });

  it("describes a branch by what it is rather than by its contents", () => {
    const byKey = new Map(
      completionsFor("")?.completions.map((c) => [c.key, c.preview])
    );

    expect(byKey.get("attributes")).toBe("object");
    expect(byKey.get("events")).toBe("list · 1");
  });

  it("indexes into a list", () => {
    const result = completionsFor("session.turns.", SESSION_SOURCE, "session");

    expect(result?.completions.map((completion) => completion.path)).toEqual([
      "session.turns[0]",
    ]);
  });

  it("pins suggested paths above the record's own list, at the root only", () => {
    const rooted = completionsFor("", SPAN_SOURCE, "span", [
      { path: "input_value", description: "the raw input" },
      { path: "attributes.llm", description: "the llm attributes" },
    ]);

    expect(rooted?.completions[0]).toMatchObject({
      key: "input_value",
      path: "span.input_value",
      section: "suggested",
      description: "the raw input",
    });
    expect(rooted?.completions[1]).toMatchObject({
      key: "attributes.llm",
      path: "span.attributes.llm",
      section: "suggested",
    });
    expect(
      rooted?.completions.filter((c) => c.section === "suggested")
    ).toHaveLength(2);

    const drilled = completionsFor("span.attributes.", SPAN_SOURCE, "span", [
      { path: "input_value", description: "the raw input" },
    ]);

    expect(drilled?.completions.every((c) => c.section === "members")).toBe(
      true
    );
  });

  it("offers a suggestion only when it resolves on the record", () => {
    // The record has no attributes.retrieval, so suggesting it would pin a
    // path that fails the moment it is accepted.
    const rooted = completionsFor("", SPAN_SOURCE, "span", [
      { path: "attributes.retrieval.documents", description: "no such field" },
      { path: "input_value", description: "the raw input" },
    ]);

    const suggested = rooted?.completions.filter(
      (c) => c.section === "suggested"
    );
    expect(suggested?.map((c) => c.key)).toEqual(["input_value"]);
  });

  it("pins nothing when the grain is configured with no suggestions", () => {
    const result = completionsFor(
      "",
      SESSION_SOURCE,
      "session",
      // Asserts the root list is what is left, not that a key was filtered.
      []
    );

    expect(result?.completions.every((c) => c.section === "members")).toBe(
      true
    );
  });

  it("offers nothing for a level the record does not have", () => {
    expect(completionsFor("span.nope.")).toBeNull();
  });

  it("offers nothing when no record has been sampled", () => {
    expect(completionsFor("", {})).toBeNull();
  });

  it("caps a browsed level, and lifts the cap once the user types", () => {
    const wide = Object.fromEntries(
      Array.from({ length: MAX_BROWSE_MEMBERS + 5 }, (_, index) => [
        `field_${index}`,
        index,
      ])
    );

    expect(completionsFor("", { span: wide })?.completions).toHaveLength(
      MAX_BROWSE_MEMBERS
    );
    expect(completionsFor("field", { span: wide })?.completions).toHaveLength(
      MAX_BROWSE_MEMBERS + 5
    );
  });
});

describe("resolveEvaluatorPath", () => {
  it("resolves a path the record holds", () => {
    expect(
      resolveEvaluatorPath({
        source: SPAN_SOURCE,
        path: "span.attributes.llm.model_name",
      })
    ).toEqual({ status: "resolved", value: "gpt-4o-mini" });
  });

  it("resolves a path written against the mapping source rather than the record", () => {
    expect(
      resolveEvaluatorPath({
        source: SPAN_SOURCE,
        path: "metadata.attributes.llm.model_name",
      })
    ).toEqual({ status: "resolved", value: "gpt-4o-mini" });
  });

  it("blames the segment that named nothing, not the whole path", () => {
    const path = "span.attributes.nope.model_name";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 16, to: 20 },
    });
    expect(path.slice(16, 20)).toBe("nope");
  });

  it("blames a subscript by the text that wrote it", () => {
    const path = "span.attributes['llm.missing']";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 15, to: 30 },
    });
  });

  it("reads an index out of a list, and rejects one past its end", () => {
    expect(
      resolveEvaluatorPath({
        source: SESSION_SOURCE,
        path: "session.turns[0].input",
      })
    ).toEqual({ status: "resolved", value: "hi" });
    expect(
      resolveEvaluatorPath({
        source: SESSION_SOURCE,
        path: "session.turns[1]",
      }).status
    ).toBe("unresolved");
  });

  it("holds back on paths nothing here can check", () => {
    // No record sampled yet
    expect(resolveEvaluatorPath({ source: {}, path: "span.nope" })).toEqual({
      status: "unverifiable",
    });
    // Syntax only the server resolves
    expect(
      resolveEvaluatorPath({ source: SPAN_SOURCE, path: "span.events[*].name" })
    ).toEqual({ status: "unverifiable" });
  });

  it("treats an unwritten path as fine, since the slot falls back to its default", () => {
    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path: "" })).toEqual({
      status: "resolved",
      value: undefined,
    });
  });
});
