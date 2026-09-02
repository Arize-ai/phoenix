import { EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@uiw/react-codemirror";
import { describe, expect, it } from "vitest";

import { materializeEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

import {
  findOpenTemplateVariable,
  isAtEmptyTemplateVariable,
} from "../autocomplete";
import { TemplateFormats } from "../constants";
import { getEvaluatorTemplateCompletions } from "../evaluatorTemplateCompletions";
import type { TemplateFormat } from "../types";

const SPAN_ATTRIBUTES = {
  llm: {
    model_name: "gpt-4o-mini",
    input_messages: [{ role: "user", content: "Why?" }],
    "invocation.parameters": { temperature: 0 },
  },
};

function buildContext(grain: ProjectEvaluatorMappingSourceGrain) {
  const metadata =
    grain === "span"
      ? {
          span_id: "7f3b1c9a",
          name: "ChatCompletion",
          latency_ms: 842.5,
          attributes: SPAN_ATTRIBUTES,
          events: [],
          annotations: {},
        }
      : {
          first_input: "Hello",
          turns: [{ input: "Hello", output: "Because." }],
        };
  return materializeEvaluatorContext({
    grain,
    evaluatorMappingSource:
      grain === "span"
        ? { grain, source: { input: "Why?", output: "Because.", metadata } }
        : { grain, source: { input: "Hello", output: "Because.", metadata } },
    inputMapping: { pathMapping: {}, literalMapping: {} },
  });
}

/** Completions for a template whose whole text sits before the cursor. */
function complete({
  doc,
  grain = "span",
  templateFormat = TemplateFormats.Mustache,
  sectionStack = [],
}: {
  doc: string;
  grain?: ProjectEvaluatorMappingSourceGrain;
  templateFormat?: TemplateFormat;
  sectionStack?: string[];
}) {
  const evaluationContext = buildContext(grain);
  if (evaluationContext === null) {
    throw new Error("expected a materialized evaluator context");
  }
  const variable = findOpenTemplateVariable(doc, templateFormat);
  if (variable === null) {
    throw new Error(`no open template variable in ${doc}`);
  }
  return getEvaluatorTemplateCompletions({
    evaluationContext,
    templateFormat,
    variable,
    sectionStack,
  });
}

/**
 * Commits a row against state alone — jsdom cannot host a live `EditorView`,
 * and the applier only reads `state`.
 */
function applyCompletion({
  before,
  after = "",
  label,
  templateFormat,
}: {
  /** Template text to the left of the cursor. */
  before: string;
  /** Template text to its right, which the applier may take back with it. */
  after?: string;
  label: string;
  templateFormat?: TemplateFormat;
}): { doc: string; head: number } {
  const result = complete({ doc: before, templateFormat });
  const completion = result?.options.find((option) => option.label === label);
  if (typeof completion?.apply !== "function") {
    throw new Error(`"${label}" is not offered for ${before}`);
  }
  let state = EditorState.create({ doc: `${before}${after}` });
  completion.apply(
    {
      get state() {
        return state;
      },
      dispatch: (spec: TransactionSpec) => {
        state = state.update(spec).state;
      },
    } as unknown as EditorView,
    completion,
    result!.from,
    before.length
  );
  return { doc: state.doc.toString(), head: state.selection.main.head };
}

describe("isAtEmptyTemplateVariable", () => {
  it("recognizes a variable site with nothing typed into it", () => {
    const cases: [string, TemplateFormat, boolean][] = [
      ["Rate this: {{", TemplateFormats.Mustache, true],
      ["", TemplateFormats.Mustache, false],
      ["Rate this: {{metadata", TemplateFormats.Mustache, false],
      ["Rate this: {{metadata.name}} ", TemplateFormats.Mustache, false],
      ["Rate this: {", TemplateFormats.FString, true],
      ["Rate this: {input} ", TemplateFormats.FString, false],
    ];

    expect(
      cases.map(([beforeCursor, templateFormat]) =>
        isAtEmptyTemplateVariable({ beforeCursor, templateFormat })
      )
    ).toEqual(cases.map(([, , expected]) => expected));
  });

  it("offers the whole root set at an empty site inside existing text", () => {
    const mustache = complete({ doc: "Rate this: {{" });

    expect(mustache?.options.slice(0, 3).map((option) => option.label)).toEqual(
      ["input", "output", "metadata"]
    );
    expect(mustache?.options.map((option) => option.label)).toContain(
      "metadata.latency_ms"
    );
    // An f-string binds a dotted path by its root, so it offers the same tree.
    expect(
      complete({
        doc: "Rate this: {",
        templateFormat: TemplateFormats.FString,
      })?.options.map((option) => option.label)
    ).toEqual(mustache?.options.map((option) => option.label));
  });
});

describe("getEvaluatorTemplateCompletions", () => {
  it("offers the evaluator's inputs and then the record's own names", () => {
    const spanResult = complete({ doc: "{{" });

    expect(
      spanResult?.options.slice(0, 3).map((option) => ({
        label: option.label,
        detail: option.detail,
        section: option.section,
      }))
    ).toEqual([
      // Every slot here is unmapped, so each binds the context key it is
      // already named after; the sampled value is what the row has left to
      // teach, and an origin repeating the label is dropped.
      {
        label: "input",
        detail: "Why?",
        section: { name: "Evaluator input", rank: 1 },
      },
      {
        label: "output",
        detail: "Because.",
        section: { name: "Evaluator input", rank: 1 },
      },
      {
        label: "metadata",
        detail: "object · 6",
        section: { name: "Evaluator input", rank: 1 },
      },
    ]);
    expect(
      spanResult?.options.find(
        (option) => option.label === "metadata.latency_ms"
      )
    ).toMatchObject({ detail: "842.5", section: { name: "From the span" } });
    // The structured fields lead the record section; the scalar record
    // fields (timestamps) close the list.
    expect(
      spanResult?.options
        .filter((option) => option.label.startsWith("metadata."))
        .slice(0, 3)
        .map((option) => option.label)
    ).toEqual([
      "metadata.attributes",
      "metadata.events",
      "metadata.annotations",
    ]);
    expect(spanResult?.options.at(-1)).toMatchObject({
      label: "metadata.end_time",
    });

    expect(
      complete({ doc: "{{", grain: "session" })?.options.find(
        (option) => option.label === "metadata.first_input"
      )
    ).toMatchObject({ section: { name: "From the session" } });
  });

  // The row is a whole path, and the matcher scores subword matches, so the
  // name alone finds it without anyone knowing it lives under `metadata`.
  it("finds a record name from the name alone, and writes its whole path", () => {
    const result = complete({ doc: "{{latency" });

    expect(result?.options.map((option) => option.label)).toContain(
      "metadata.latency_ms"
    );
    // The dot in `metadata.lat` is still on its way into a row on offer, so
    // the menu keeps filtering; the one in `attributes.` is not, so it
    // re-queries.
    const staysOpen = result?.validFor;
    if (typeof staysOpen !== "function") {
      throw new Error("expected the root menu to decide when it stays open");
    }
    expect(
      ["metadata", "metadata.lat", "attributes.", "metadata.attributes.a"].map(
        (text) =>
          staysOpen(text, 0, text.length, EditorState.create({ doc: text }))
      )
    ).toEqual([true, true, false, false]);
    expect(
      applyCompletion({ before: "{{latency", label: "metadata.latency_ms" })
    ).toEqual({ doc: "{{metadata.latency_ms}}", head: 23 });
    // The braces are already there, so the row takes them back with it rather
    // than writing a second pair.
    expect(
      applyCompletion({
        before: "{{latency",
        after: "}}",
        label: "metadata.latency_ms",
      }).doc
    ).toBe("{{metadata.latency_ms}}");
  });

  it("keeps the cursor inside a nested object and closes everything else", () => {
    // A record's object is a level to keep drilling: the dot is written and
    // the cursor stays before the braces.
    expect(
      applyCompletion({ before: "{{attr", label: "metadata.attributes" })
    ).toEqual({ doc: "{{metadata.attributes.}}", head: 22 });
    // One of the evaluator's own inputs is accepted whole, object or not.
    expect(applyCompletion({ before: "{{inp", label: "input" })).toEqual({
      doc: "{{input}}",
      head: 9,
    });
  });

  it("drills a level per dot in both formats", () => {
    const drilled = complete({ doc: "{{metadata.attributes.llm." });

    // Right after the dot: the menu matches the member name alone.
    expect(drilled?.from).toBe(26);
    expect(drilled?.options.map((option) => option.label)).toEqual([
      "model_name",
      "input_messages",
    ]);
    expect(drilled?.options[0]).toMatchObject({
      detail: "gpt-4o-mini",
      section: { name: "metadata.attributes.llm" },
    });

    // An f-string binds a dotted path by its root the same way, so it drills
    // the same tree and closes with its own brace.
    expect(
      complete({
        doc: "{metadata.attributes.llm.",
        templateFormat: TemplateFormats.FString,
      })?.options.map((option) => option.label)
    ).toEqual(["model_name", "input_messages"]);
    expect(
      applyCompletion({
        before: "{latency",
        label: "metadata.latency_ms",
        templateFormat: TemplateFormats.FString,
      })
    ).toEqual({ doc: "{metadata.latency_ms}", head: 21 });
  });

  // A record name is offered by its whole path, so the dot that opens it has
  // to read the home back in rather than throw away the match the name had.
  it("opens the record's level from the name typed without its home", () => {
    const result = complete({ doc: "{{attributes." });

    // The row rewrites the whole variable, so the menu matches from its start.
    expect(result?.from).toBe(2);
    expect(result?.options.map((option) => option.label)).toEqual([
      "metadata.attributes.llm",
    ]);
    expect(result?.options[0]).toMatchObject({
      section: { name: "metadata.attributes" },
    });
    expect(
      applyCompletion({
        before: "{{attributes.",
        label: "metadata.attributes.llm",
      })
    ).toEqual({ doc: "{{metadata.attributes.llm.}}", head: 26 });

    // Mustache has no bracket syntax, so the session's turns are reached as a
    // repeat block rather than by index — offered at the root by the same
    // whole path the variable menu uses.
    for (const doc of ["{{#", "{{#metadata."]) {
      expect(
        complete({ doc, grain: "session" })?.options.map(
          (option) => option.label
        )
      ).toContain("#metadata.turns");
    }
  });

  it("offers repeat blocks for what a block can wrap", () => {
    const repeats = complete({ doc: "{{#metadata.attributes.llm." });

    expect(repeats?.options).toMatchObject([
      {
        label: "#metadata.attributes.llm.input_messages",
        detail: "1 items",
        section: { name: "Blocks" },
      },
    ]);
  });

  it("names a section's own fields while the cursor is inside it", () => {
    const inSection = complete({
      doc: "{{#metadata.attributes.llm.input_messages}}{{",
      sectionStack: ["metadata.attributes.llm.input_messages"],
    });

    expect(inSection?.options.map((option) => option.label)).toEqual([
      "role",
      "content",
    ]);
  });
});
