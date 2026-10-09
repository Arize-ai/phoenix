import { EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

import type { ProjectEvaluatorRecordKind } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { parsePathSegments } from "@phoenix/utils/objectUtils";

import type { EvaluatorPathCompletion } from "../evaluatorPathCompletions";
import {
  appendPathSegment,
  applyEvaluatorPathCompletion,
  CONTAINER_COMPLETION_TYPE,
  getEvaluatorPathCompletions,
  getEvaluatorPathCursor,
  IDEA_COMPLETION_TYPE,
  MAX_BROWSE_MEMBERS,
  PATH_CONTINUATION_SECTION_RANK,
  PATH_MEMBER_SECTION_RANK,
  resolveEvaluatorPath,
  SUGGESTED_PATH_SECTION,
  toMemberSection,
  UNSET_COMPLETION_TYPE,
} from "../evaluatorPathCompletions";
import {
  getEvaluatorPathIdeas,
  MAPPING_PATH_SYNTAX,
} from "../evaluatorPathIdeas";

const SPAN_SOURCE: Record<string, unknown> = {
  input: "what is the weather?",
  output: "sunny",
  metadata: {
    span_id: "7f3b1c9a",
    latency_ms: 842.5,
    attributes: {
      llm: { model_name: "gpt-4o-mini", token_count: { total: 100 } },
      "llm.deprecated": "legacy",
    },
    events: [{ name: "exception" }],
  },
};

const SESSION_SOURCE: Record<string, unknown> = {
  input: "hi",
  output: "hello",
  metadata: {
    first_input: "hi",
    session_id: "abc",
    turns: [{ input: "hi", output: "hello" }],
  },
};

const CHAT_SOURCE: Record<string, unknown> = {
  input: {
    messages: [
      { role: "system", content: "Be brief." },
      { role: "user", content: "What is the weather?" },
    ],
  },
  output: {
    documents: [
      { id: "a", content: "Sunny" },
      { id: "b", score: 0.4 },
    ],
  },
  metadata: {},
};

const ROOT_CANDIDATES: EvaluatorPathCompletion[] = [
  {
    key: "input",
    path: "input",
    detail: "what is the weather?",
    section: { name: "Evaluator input", rank: 1 },
  },
  {
    key: "metadata.latency_ms",
    path: "metadata.latency_ms",
    detail: "842.5",
    section: { name: "From the span", rank: 2 },
  },
  {
    key: "metadata.attributes",
    path: "metadata.attributes",
    detail: "object · 2",
    section: { name: "From the span", rank: 2 },
  },
];

const SESSION_ROOT_CANDIDATES: EvaluatorPathCompletion[] = [
  {
    key: "metadata.turns",
    path: "metadata.turns",
    detail: "list · 1",
    section: { name: "From the session", rank: 2 },
  },
];

const completionsFor = (
  textBeforeCursor: string,
  source = SPAN_SOURCE,
  ideasFor?: ProjectEvaluatorRecordKind,
  rootCandidates: EvaluatorPathCompletion[] = ROOT_CANDIDATES,
  isExplicit = false
) =>
  getEvaluatorPathCompletions({
    source,
    rootCandidates,
    isExplicit,
    ...(ideasFor === undefined
      ? {}
      : {
          getIdeas: (containerPath: string) =>
            getEvaluatorPathIdeas({
              recordKind: ideasFor,
              source,
              containerPath,
              syntax: MAPPING_PATH_SYNTAX,
            }),
        }),
    textBeforeCursor,
  });

describe("appendPathSegment", () => {
  // What the field writes is what the server parses, so the keys have to
  // survive the round trip — attribute keys carry dots of their own.
  it("emits paths that resolve back to the keys they were built from", () => {
    const path = ["attributes", "llm.model_name"].reduce(
      (parent, key) => appendPathSegment(parent, key, false),
      "metadata"
    );

    expect(path).toBe("metadata.attributes['llm.model_name']");
    expect(parsePathSegments(path)).toEqual([
      "metadata",
      "attributes",
      "llm.model_name",
    ]);
  });

  it("indexes into a list with bracket notation", () => {
    const path = appendPathSegment(
      appendPathSegment("metadata", "turns", false),
      "0",
      true
    );

    expect(path).toBe("metadata.turns[0]");
    expect(parsePathSegments(path)).toEqual(["metadata", "turns", "0"]);
  });

  it("quotes a key the server's parser reserves", () => {
    expect(appendPathSegment("metadata", "where", false)).toBe(
      "metadata['where']"
    );
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
    expect(getEvaluatorPathCursor("metadata.attributes.")).toEqual({
      containerPath: "metadata.attributes",
      partial: "",
      from: 20,
    });
  });

  it("matches on the name alone inside an open subscript", () => {
    expect(getEvaluatorPathCursor("metadata.attributes['ll")).toEqual({
      containerPath: "metadata.attributes",
      partial: "ll",
      from: 21,
    });
  });

  it("drills past a list index", () => {
    expect(getEvaluatorPathCursor("metadata.turns[0].in")).toEqual({
      containerPath: "metadata.turns[0]",
      partial: "in",
      from: 18,
    });
  });

  it("reads every subscript the server accepts, open or closed", () => {
    for (const partial of ["-", "-1", "*", ":", ":-1", "::2", "0,", "0,2"]) {
      expect(getEvaluatorPathCursor(`metadata.turns[${partial}`)).toEqual({
        containerPath: "metadata.turns",
        partial,
        from: 15,
      });
    }
    for (const subscript of ["[-1]", "[*]", "[:-1]", "[0,2]"]) {
      expect(
        getEvaluatorPathCursor(`metadata.turns${subscript}.`)?.containerPath
      ).toBe(`metadata.turns${subscript}`);
    }
  });
});

describe("getEvaluatorPathCompletions", () => {
  it("offers the shared candidate tree at the top of the context", () => {
    const result = completionsFor("");

    expect(result?.containerPath).toBe("");
    expect(result?.completions).toEqual(ROOT_CANDIDATES);
  });

  it("offers the next level's members after each separator", () => {
    const result = completionsFor("metadata.attributes.");

    expect(result?.from).toBe(20);
    expect(result?.containerPath).toBe("metadata.attributes");
    expect(result?.completions.map((completion) => completion.path)).toEqual([
      "metadata.attributes.llm",
      "metadata.attributes['llm.deprecated']",
    ]);
    expect(result?.completions[0]?.section).toEqual(
      toMemberSection("metadata.attributes", PATH_MEMBER_SECTION_RANK)
    );
  });

  // A container typed in full is a path in its own right, and the menu that
  // reopens on it has to show what comes next.
  it("offers a name typed in full by what it holds", () => {
    const result = completionsFor("metadata.attributes");

    expect(result?.from).toBe(9);
    expect(result?.completions.map(({ key, drills }) => [key, drills])).toEqual(
      [
        // The name itself is already written, so its row ends the path.
        ["attributes", false],
        ["span_id", false],
        ["latency_ms", false],
        ["events", true],
        ["attributes.llm", true],
        ["attributes['llm.deprecated']", false],
      ]
    );
    expect(result?.completions[4]?.section).toEqual(
      toMemberSection("metadata.attributes", PATH_CONTINUATION_SECTION_RANK + 1)
    );
    expect(
      completionsFor("metadata.events", SPAN_SOURCE, "span")?.completions.map(
        (c) => c.key
      )
    ).toContain("events[0]");
  });

  it("previews the value each member holds on the record", () => {
    const result = completionsFor("metadata.attributes.llm.");

    expect(result?.completions.map(({ key, detail }) => [key, detail])).toEqual(
      [
        ["model_name", "gpt-4o-mini"],
        ["token_count", "object · 1"],
      ]
    );
  });

  it("describes a branch by what it is rather than by its contents", () => {
    const byKey = new Map(
      completionsFor("metadata.")?.completions.map((c) => [c.key, c.detail])
    );

    expect(byKey.get("attributes")).toBe("object · 2");
    expect(byKey.get("events")).toBe("list · 1");
  });

  it("leads each level with its ideas, written from the level", () => {
    const result = completionsFor("input.messages[", CHAT_SOURCE, "span");

    // A list's rows are subscripts, matched from the bracket that opens one.
    expect(result?.from).toBe(14);
    // An idea shows its path beside what it reaches, and previews its value
    // when highlighted.
    expect(
      result?.completions.map(({ key, path, detail, info }) => [
        key,
        path,
        detail,
        info,
      ])
    ).toEqual([
      [
        "[-1].content",
        "input.messages[-1].content",
        "Last message",
        "What is the weather?",
      ],
      ["[0]", "input.messages[0]", "First message", "object · 2"],
      ["[-1]", "input.messages[-1]", "Last message", "object · 2"],
      ["[*]", "input.messages[*]", "All messages", "list · 2"],
      ["[:-1]", "input.messages[:-1]", "All but last", "object · 2"],
    ]);
    expect(
      result?.completions.every(
        ({ section }) => section === SUGGESTED_PATH_SECTION
      )
    ).toBe(true);
    expect(result?.completions.map(({ boost }) => boost)).toEqual([
      5, 4, 3, 2, 1,
    ]);

    // A field an idea already offers is not offered twice.
    expect(
      completionsFor("input.", CHAT_SOURCE, "span")?.completions.filter(
        ({ path }) => path === "input.messages"
      )
    ).toHaveLength(1);
  });

  it("offers an index typed in full when the list has it", () => {
    const at = (text: string) =>
      completionsFor(text, CHAT_SOURCE)?.completions.map(({ key, path }) => [
        key,
        path,
      ]);

    expect(at("input.messages[-2")).toContainEqual([
      "[-2]",
      "input.messages[-2]",
    ]);
    expect(at("input.messages[1")).toContainEqual(["[1]", "input.messages[1]"]);
    expect(at("input.messages[7")).toBeUndefined();
  });

  it("offers the fields several matches have between them", () => {
    const result = completionsFor("output.documents[*].", CHAT_SOURCE);

    expect(
      result?.completions.map(({ key, path, detail }) => [key, path, detail])
    ).toEqual([
      ["id", "output.documents[*].id", "list · 2"],
      ["content", "output.documents[*].content", "Sunny"],
      ["score", "output.documents[*].score", "0.4"],
    ]);
  });

  // A row that holds more reopens on what it holds, and that menu leads with
  // the path itself, so accepting twice finishes it.
  it("reopens on any row that holds more, led by the row itself", () => {
    const ideas = completionsFor("input.messages[", CHAT_SOURCE, "span");
    expect(ideas?.completions.map(({ key, drills }) => [key, drills])).toEqual([
      ["[-1].content", false],
      ["[0]", true],
      ["[-1]", true],
      ["[*]", true],
      ["[:-1]", true],
    ]);
    expect(ideas?.completions[1]?.type).toBe(
      `${IDEA_COMPLETION_TYPE} ${CONTAINER_COMPLETION_TYPE}`
    );

    const reopened = completionsFor("input.messages", CHAT_SOURCE, "span");
    expect(
      reopened?.completions
        .slice(0, 3)
        .map(({ key, drills, section }) => [key, drills, section.name])
    ).toEqual([
      ["messages", false, "input"],
      ["tools", false, "input"],
      ["messages[-1].content", false, "Suggestions"],
    ]);
  });

  it("offers the level below an evaluator input typed in full", () => {
    const input: EvaluatorPathCompletion = {
      key: "input",
      path: "input",
      detail: "object · 1",
      section: { name: "Evaluator input", rank: 1 },
      type: CONTAINER_COMPLETION_TYPE,
      drills: true,
    };
    const result = completionsFor("input", CHAT_SOURCE, "span", [input]);

    expect(
      result?.completions.map(({ key, drills, type }) => [key, drills, type])
    ).toEqual([
      ["input", false, "variable"],
      ["input.messages[-1].content", false, IDEA_COMPLETION_TYPE],
      [
        "input.messages",
        true,
        `${IDEA_COMPLETION_TYPE} ${CONTAINER_COMPLETION_TYPE}`,
      ],
      [
        "input.messages[-1]",
        true,
        `${IDEA_COMPLETION_TYPE} ${CONTAINER_COMPLETION_TYPE}`,
      ],
      ["input.messages[*].content", false, IDEA_COMPLETION_TYPE],
      [
        "input.tools",
        false,
        `${IDEA_COMPLETION_TYPE} ${UNSET_COMPLETION_TYPE}`,
      ],
    ]);
  });

  it("opens the level below a closed subscript only when asked", () => {
    expect(
      completionsFor("input.messages[-1]", CHAT_SOURCE, "span")
    ).toBeNull();

    const asked = completionsFor(
      "input.messages[-1]",
      CHAT_SOURCE,
      "span",
      ROOT_CANDIDATES,
      true
    );
    expect(asked?.from).toBe(14);
    expect(asked?.completions.map(({ key, drills }) => [key, drills])).toEqual([
      ["[-1]", false],
      ["[-1].content", false],
      ["[-1].role", false],
    ]);
    expect(
      completionsFor("input.messages[-1].", CHAT_SOURCE)?.completions.map(
        ({ key }) => key
      )
    ).toEqual(["role", "content"]);
  });

  it("leads the top level with its ideas, above the candidate tree", () => {
    const rooted = completionsFor("", CHAT_SOURCE, "span");

    expect(
      rooted?.completions.map(({ key, section }) => [key, section.name])
    ).toEqual([
      ["input.messages[-1].content", "Suggestions"],
      ["input.messages", "Suggestions"],
      ["output.documents[*].content", "Suggestions"],
      ["output.documents[0].content", "Suggestions"],
      ["input.tools", "Suggestions"],
      ["input", "Evaluator input"],
      ["metadata.latency_ms", "From the span"],
      ["metadata.attributes", "From the span"],
    ]);
    expect(rooted?.completions[0]?.section).toBe(SUGGESTED_PATH_SECTION);
  });

  // A record name is offered by its whole path, so drilling one has to read
  // the home back in — otherwise the dot that opens the level throws away the
  // match the name alone already had.
  it("opens the level below a record name typed without its home", () => {
    const result = completionsFor("attributes.");

    expect(result?.containerPath).toBe("metadata.attributes");
    // The row rewrites the whole path, so the typeahead matches from the start
    // of what was written rather than from after the dot.
    expect(result?.from).toBe(0);
    expect(result?.completions.map((completion) => completion.key)).toEqual([
      "metadata.attributes.llm",
      "metadata.attributes['llm.deprecated']",
    ]);
    expect(result?.completions[0]?.section).toEqual(
      toMemberSection("metadata.attributes", PATH_MEMBER_SECTION_RANK)
    );

    expect(completionsFor("attributes")?.completions).toEqual(ROOT_CANDIDATES);

    expect(
      completionsFor(
        "turns.",
        SESSION_SOURCE,
        "session",
        SESSION_ROOT_CANDIDATES
      )?.completions.map((completion) => completion.key)
    ).toEqual([
      "metadata.turns[-1].input",
      "metadata.turns[-1].output",
      "metadata.turns[*].input",
      "metadata.turns[0]",
      "metadata.turns[-1]",
    ]);
  });

  it("carries the rest of a path across the home it reads back in", () => {
    expect(
      completionsFor("attributes.llm.")?.completions.map((c) => c.path)
    ).toEqual([
      "metadata.attributes.llm.model_name",
      "metadata.attributes.llm.token_count",
    ]);
  });

  it("offers nothing for a level the record does not have", () => {
    expect(completionsFor("metadata.nope.")).toBeNull();
  });

  // An idea the record lacks stays on offer, dimmed, so what a record of its
  // kind usually holds is still discoverable.
  it("dims an idea the record does not have", () => {
    const result = completionsFor("input.", CHAT_SOURCE, "span");

    expect(
      result?.completions.find(({ path }) => path === "input.tools")
    ).toEqual({
      key: "tools",
      path: "input.tools",
      detail: "Available tools",
      info: "Not here",
      type: `${IDEA_COMPLETION_TYPE} ${UNSET_COMPLETION_TYPE}`,
      section: SUGGESTED_PATH_SECTION,
      drills: false,
      boost: 1,
    });
  });

  it("offers nothing when the surface has no tree to offer", () => {
    expect(completionsFor("", {}, "span", [])).toBeNull();
  });

  it("caps a browsed level, and lifts the cap once the user types", () => {
    const wide = {
      metadata: Object.fromEntries(
        Array.from({ length: MAX_BROWSE_MEMBERS + 5 }, (_, index) => [
          `field_${index}`,
          index,
        ])
      ),
    };

    expect(completionsFor("metadata.", wide)?.completions).toHaveLength(
      MAX_BROWSE_MEMBERS
    );
    expect(completionsFor("metadata.field", wide)?.completions).toHaveLength(
      MAX_BROWSE_MEMBERS + 5
    );
  });
});

describe("resolveEvaluatorPath", () => {
  it("resolves a path the context holds", () => {
    expect(
      resolveEvaluatorPath({
        source: SPAN_SOURCE,
        path: "metadata.attributes.llm.model_name",
      })
    ).toMatchObject({ status: "resolved", value: "gpt-4o-mini" });
  });

  it("resolves the record's own names, flat under metadata", () => {
    expect(
      resolveEvaluatorPath({ source: SPAN_SOURCE, path: "metadata.latency_ms" })
    ).toMatchObject({ status: "resolved", value: 842.5 });
  });

  it("blames the segment that named nothing, not the whole path", () => {
    const path = "metadata.attributes.nope.model_name";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 20, to: 24 },
    });
    expect(path.slice(20, 24)).toBe("nope");
  });

  it("blames a subscript by the text that wrote it", () => {
    const path = "metadata.attributes['llm.missing']";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 19, to: 34 },
    });
  });

  it("rejects an inherited property the server's JSONPath cannot reach", () => {
    const path = "metadata.toString";

    expect(resolveEvaluatorPath({ source: { metadata: {} }, path })).toEqual({
      status: "unresolved",
      range: { from: 9, to: 17 },
    });
    expect(path.slice(9, 17)).toBe("toString");
  });

  it("reads an index out of a list, and rejects one past its end", () => {
    expect(
      resolveEvaluatorPath({
        source: SESSION_SOURCE,
        path: "metadata.turns[0].input",
      })
    ).toMatchObject({ status: "resolved", value: "hi" });
    expect(
      resolveEvaluatorPath({
        source: SESSION_SOURCE,
        path: "metadata.turns[1]",
      }).status
    ).toBe("unresolved");
  });

  it("holds back on a path until a record is sampled", () => {
    expect(resolveEvaluatorPath({ source: {}, path: "metadata.nope" })).toEqual(
      { status: "unverifiable" }
    );
  });

  it("blames the text where a path the server rejects goes wrong", () => {
    const path = "metadata.events.0";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "invalid",
      range: { from: 16, to: 17 },
    });
    expect(resolveEvaluatorPath({ source: {}, path }).status).toBe("invalid");
  });

  it("binds one match bare and several as a list, keeping every match", () => {
    expect(
      resolveEvaluatorPath({
        source: SPAN_SOURCE,
        path: "metadata.events[*].name",
      })
    ).toEqual({
      status: "resolved",
      value: "exception",
      matches: ["exception"],
    });
    expect(
      resolveEvaluatorPath({
        source: { metadata: { events: [{ name: "a" }, { name: "b" }] } },
        path: "metadata.events[*].name",
      })
    ).toEqual({ status: "resolved", value: ["a", "b"], matches: ["a", "b"] });
  });

  it("blames the subscript the server raises on", () => {
    const path = "metadata.events[-2].name";

    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path })).toEqual({
      status: "unresolved",
      range: { from: 15, to: 19 },
    });
    expect(path.slice(15, 19)).toBe("[-2]");
  });

  it("treats an unwritten path as fine, since the slot falls back to its default", () => {
    expect(resolveEvaluatorPath({ source: SPAN_SOURCE, path: "" })).toEqual({
      status: "resolved",
      value: undefined,
      matches: [],
    });
  });
});

describe("applyEvaluatorPathCompletion", () => {
  /** Commits a row against state alone; the applier only reads `state`. */
  function accept(
    completion: Parameters<typeof applyEvaluatorPathCompletion>[0],
    typed: string,
    autoClosed = ""
  ) {
    let state = EditorState.create({ doc: `${typed}${autoClosed}` });
    applyEvaluatorPathCompletion(completion)(
      {
        get state() {
          return state;
        },
        dispatch: (spec: TransactionSpec) => {
          state = state.update(spec).state;
        },
      } as unknown as EditorView,
      { label: completion.key },
      0,
      typed.length
    );
    return { doc: state.doc.toString(), head: state.selection.main.head };
  }

  it("writes a container as it is and ends a finished path", () => {
    const section = { name: "metadata" };
    expect(
      accept(
        {
          key: "attributes",
          path: "metadata.attributes",
          detail: "",
          section,
          drills: true,
        },
        "attr"
      )
    ).toEqual({ doc: "metadata.attributes", head: 19 });
    expect(
      accept(
        {
          key: "latency_ms",
          path: "metadata.latency_ms",
          detail: "",
          section,
        },
        "lat"
      )
    ).toEqual({ doc: "metadata.latency_ms", head: 19 });
  });

  it("takes the bracket an open subscript auto-closed", () => {
    const section = { name: "input.messages" };
    expect(
      accept(
        { key: "-1]", path: "input.messages[-1]", detail: "", section },
        "input.messages[-",
        "]"
      )
    ).toEqual({ doc: "input.messages[-1]", head: 18 });
    expect(
      accept(
        { key: "llm", path: "metadata['llm']", detail: "", section },
        "metadata['ll",
        "']"
      )
    ).toEqual({ doc: "metadata['llm']", head: 15 });
  });
});
