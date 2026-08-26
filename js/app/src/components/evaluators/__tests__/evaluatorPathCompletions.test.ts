import { parsePathSegments } from "@phoenix/utils/objectUtils";

import type { EvaluatorPathCompletion } from "../evaluatorPathCompletions";
import {
  appendPathSegment,
  getEvaluatorPathCompletions,
  getEvaluatorPathCursor,
  MAX_BROWSE_MEMBERS,
  resolveEvaluatorPath,
  SUGGESTED_PATH_SECTION,
  toPathMemberSection,
} from "../evaluatorPathCompletions";

const SPAN_RECORD: Record<string, unknown> = {
  span_id: "7f3b1c9a",
  input_value: "what is the weather?",
  attributes: {
    llm: { model_name: "gpt-4o-mini", token_count: { total: 100 } },
    "llm.deprecated": "legacy",
  },
  events: [{ name: "exception" }],
};

const SPAN_SOURCE: Record<string, unknown> = {
  input: "what is the weather?",
  output: "sunny",
  metadata: { span_id: "7f3b1c9a", latency_ms: 842.5, span: SPAN_RECORD },
};

const SESSION_SOURCE: Record<string, unknown> = {
  input: "hi",
  output: "hello",
  metadata: {
    first_input: "hi",
    session: { session_id: "abc", turns: [{ input: "hi", output: "hello" }] },
  },
};

/** Stands in for the shared candidate tree the surfaces feed this. */
const ROOT_CANDIDATES: EvaluatorPathCompletion[] = [
  {
    key: "input",
    path: "input",
    preview: "what is the weather?",
    section: { name: "Evaluator input", rank: 1 },
  },
  {
    key: "metadata.latency_ms",
    path: "metadata.latency_ms",
    preview: "842.5",
    section: { name: "From the span", rank: 2 },
  },
];

const completionsFor = (
  textBeforeCursor: string,
  source = SPAN_SOURCE,
  suggestedPaths: readonly { path: string; description: string }[] = [],
  rootCandidates: EvaluatorPathCompletion[] = ROOT_CANDIDATES
) =>
  getEvaluatorPathCompletions({
    source,
    rootCandidates,
    suggestedPaths,
    textBeforeCursor,
  });

describe("appendPathSegment", () => {
  // What the field writes is what the server parses, so the keys have to
  // survive the round trip — attribute keys carry dots of their own.
  it("emits paths that resolve back to the keys they were built from", () => {
    const path = ["attributes", "llm.model_name"].reduce(
      (parent, key) => appendPathSegment(parent, key, false),
      "metadata.span"
    );

    expect(path).toBe("metadata.span.attributes['llm.model_name']");
    expect(parsePathSegments(path)).toEqual([
      "metadata",
      "span",
      "attributes",
      "llm.model_name",
    ]);
  });

  it("indexes into a list with bracket notation", () => {
    const path = appendPathSegment(
      appendPathSegment("metadata.session", "turns", false),
      "0",
      true
    );

    expect(path).toBe("metadata.session.turns[0]");
    expect(parsePathSegments(path)).toEqual([
      "metadata",
      "session",
      "turns",
      "0",
    ]);
  });
});

describe("getEvaluatorPathCursor", () => {
  it("treats a trailing name as still being typed", () => {
    expect(getEvaluatorPathCursor("metadata")).toEqual({
      containerPath: "",
      partial: "metadata",
      from: 0,
    });
  });

  it("opens the level below once the separator is typed", () => {
    expect(getEvaluatorPathCursor("metadata.span.attributes.")).toEqual({
      containerPath: "metadata.span.attributes",
      partial: "",
      from: 25,
    });
  });

  it("matches on the name alone inside an open subscript", () => {
    expect(getEvaluatorPathCursor("metadata.span.attributes['ll")).toEqual({
      containerPath: "metadata.span.attributes",
      partial: "ll",
      from: 26,
    });
  });

  it("drills past a list index", () => {
    expect(getEvaluatorPathCursor("metadata.session.turns[0].in")).toEqual({
      containerPath: "metadata.session.turns[0]",
      partial: "in",
      from: 26,
    });
  });
});

describe("getEvaluatorPathCompletions", () => {
  it("offers the shared candidate tree at the top of the context", () => {
    const result = completionsFor("");

    expect(result?.containerPath).toBe("");
    expect(result?.completions).toEqual(ROOT_CANDIDATES);
  });

  it("offers the next level's members after each separator", () => {
    const result = completionsFor("metadata.span.attributes.");

    expect(result?.from).toBe(25);
    expect(result?.containerPath).toBe("metadata.span.attributes");
    expect(result?.completions.map((completion) => completion.path)).toEqual([
      "metadata.span.attributes.llm",
      "metadata.span.attributes['llm.deprecated']",
    ]);
    expect(result?.completions[0]?.section).toEqual(
      toPathMemberSection("metadata.span.attributes")
    );
  });

  it("previews the value each member holds on the record", () => {
    const result = completionsFor("metadata.span.attributes.llm.");

    expect(
      result?.completions.map(({ key, preview }) => [key, preview])
    ).toEqual([
      ["model_name", "gpt-4o-mini"],
      ["token_count", "object"],
    ]);
  });

  it("describes a branch by what it is rather than by its contents", () => {
    const byKey = new Map(
      completionsFor("metadata.span.")?.completions.map((c) => [
        c.key,
        c.preview,
      ])
    );

    expect(byKey.get("attributes")).toBe("object");
    expect(byKey.get("events")).toBe("list · 1");
  });

  it("indexes into a list", () => {
    const result = completionsFor("metadata.session.turns.", SESSION_SOURCE);

    expect(result?.completions.map((completion) => completion.path)).toEqual([
      "metadata.session.turns[0]",
    ]);
  });

  it("pins suggested paths above the candidate tree, at the top only", () => {
    const rooted = completionsFor("", SPAN_SOURCE, [
      { path: "metadata.span.input_value", description: "the raw input" },
      { path: "metadata.span.attributes.llm", description: "the llm block" },
    ]);

    expect(rooted?.completions.slice(0, 2)).toEqual([
      {
        key: "metadata.span.input_value",
        path: "metadata.span.input_value",
        preview: "what is the weather?",
        section: SUGGESTED_PATH_SECTION,
        description: "the raw input",
      },
      {
        key: "metadata.span.attributes.llm",
        path: "metadata.span.attributes.llm",
        preview: "object",
        section: SUGGESTED_PATH_SECTION,
        description: "the llm block",
      },
    ]);

    const drilled = completionsFor("metadata.span.attributes.", SPAN_SOURCE, [
      { path: "metadata.span.input_value", description: "the raw input" },
    ]);

    expect(
      drilled?.completions.every((c) => c.section !== SUGGESTED_PATH_SECTION)
    ).toBe(true);
  });

  it("offers a suggestion only when it resolves on the record", () => {
    // The record has no attributes.retrieval, so suggesting it would pin a
    // path that fails the moment it is accepted.
    const rooted = completionsFor("", SPAN_SOURCE, [
      {
        path: "metadata.span.attributes.retrieval.documents",
        description: "no such field",
      },
      { path: "metadata.span.input_value", description: "the raw input" },
    ]);

    expect(
      rooted?.completions
        .filter((c) => c.section === SUGGESTED_PATH_SECTION)
        .map((c) => c.key)
    ).toEqual(["metadata.span.input_value"]);
  });

  it("offers nothing for a level the record does not have", () => {
    expect(completionsFor("metadata.span.nope.")).toBeNull();
  });

  it("offers nothing when the surface has no tree to offer", () => {
    expect(completionsFor("", {}, [], [])).toBeNull();
  });

  it("caps a browsed level, and lifts the cap once the user types", () => {
    const wide = {
      metadata: {
        span: Object.fromEntries(
          Array.from({ length: MAX_BROWSE_MEMBERS + 5 }, (_, index) => [
            `field_${index}`,
            index,
          ])
        ),
      },
    };

    expect(completionsFor("metadata.span.", wide)?.completions).toHaveLength(
      MAX_BROWSE_MEMBERS
    );
    expect(
      completionsFor("metadata.span.field", wide)?.completions
    ).toHaveLength(MAX_BROWSE_MEMBERS + 5);
  });
});

describe("resolveEvaluatorPath", () => {
  it("resolves a path the context holds", () => {
    expect(
      resolveEvaluatorPath({
        source: SPAN_SOURCE,
        path: "metadata.span.attributes.llm.model_name",
      })
    ).toEqual({ status: "resolved", value: "gpt-4o-mini" });
  });

  it("resolves the record's own names, flat under metadata", () => {
    expect(
      resolveEvaluatorPath({ source: SPAN_SOURCE, path: "metadata.latency_ms" })
    ).toEqual({ status: "resolved", value: 842.5 });
  });

  it("blames the segment that named nothing, not the whole path", () => {
    const path = "metadata.span.attributes.nope.model_name";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 25, to: 29 },
    });
    expect(path.slice(25, 29)).toBe("nope");
  });

  it("blames a subscript by the text that wrote it", () => {
    const path = "metadata.span.attributes['llm.missing']";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 24, to: 39 },
    });
  });

  it("reads an index out of a list, and rejects one past its end", () => {
    expect(
      resolveEvaluatorPath({
        source: SESSION_SOURCE,
        path: "metadata.session.turns[0].input",
      })
    ).toEqual({ status: "resolved", value: "hi" });
    expect(
      resolveEvaluatorPath({
        source: SESSION_SOURCE,
        path: "metadata.session.turns[1]",
      }).status
    ).toBe("unresolved");
  });

  it("holds back on paths nothing here can check", () => {
    // No record sampled yet
    expect(resolveEvaluatorPath({ source: {}, path: "metadata.nope" })).toEqual(
      { status: "unverifiable" }
    );
    // Syntax only the server resolves
    expect(
      resolveEvaluatorPath({
        source: SPAN_SOURCE,
        path: "metadata.span.events[*].name",
      })
    ).toEqual({ status: "unverifiable" });
  });

  it("treats an unwritten path as fine, since the slot falls back to its default", () => {
    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path: "" })).toEqual({
      status: "resolved",
      value: undefined,
    });
  });
});
