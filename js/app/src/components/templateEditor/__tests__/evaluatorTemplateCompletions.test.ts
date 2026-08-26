import { EditorState, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@uiw/react-codemirror";
import { describe, expect, it } from "vitest";

import { materializeEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import { getEvaluatorSlotDefaults } from "@phoenix/components/evaluators/evaluatorSlotDefaults";
import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

import { findOpenTemplateVariable } from "../autocomplete";
import { TemplateFormats } from "../constants";
import { getEvaluatorTemplateCompletions } from "../evaluatorTemplateCompletions";
import type { TemplateFormat } from "../types";

const SPAN_RECORD = {
  span_id: "7f3b1c9a",
  name: "ChatCompletion",
  output_value: "Because.",
  attributes: {
    llm: {
      model_name: "gpt-4o-mini",
      input_messages: [{ role: "user", content: "Why?" }],
      "invocation.parameters": { temperature: 0 },
    },
  },
};

function buildContext(grain: ProjectEvaluatorMappingSourceGrain) {
  const metadata =
    grain === "span"
      ? { latency_ms: 842.5, span: SPAN_RECORD }
      : { first_input: "Hello", session: SPAN_RECORD };
  return materializeEvaluatorContext({
    grain,
    evaluatorMappingSource:
      grain === "span"
        ? { grain, source: { input: "Why?", output: "Because.", metadata } }
        : { grain, source: { input: "Hello", output: "Because.", metadata } },
    inputMapping: { pathMapping: {}, literalMapping: {} },
    slotDefaults: getEvaluatorSlotDefaults(grain),
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
}: {
  /** Template text to the left of the cursor. */
  before: string;
  /** Template text to its right, which the applier may take back with it. */
  after?: string;
  label: string;
}): string {
  const result = complete({ doc: before });
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
  return state.doc.toString();
}

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
      {
        label: "input",
        detail: "← metadata.span.input_value",
        section: { name: "Evaluator input", rank: 1 },
      },
      {
        label: "output",
        detail: "← metadata.span.output_value",
        section: { name: "Evaluator input", rank: 1 },
      },
      {
        label: "metadata",
        detail: "← metadata",
        section: { name: "Evaluator input", rank: 1 },
      },
    ]);
    expect(
      spanResult?.options.find(
        (option) => option.label === "metadata.latency_ms"
      )
    ).toMatchObject({ detail: "842.5", section: { name: "From the span" } });
    // The record itself closes the list rather than being flattened into it.
    expect(spanResult?.options.at(-1)).toMatchObject({
      label: "metadata.span",
      detail: "object",
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

    expect(result?.validFor?.toString()).toBe(String(/^\w*(?:\.\w*)?$/));
    expect(result?.options.map((option) => option.label)).toContain(
      "metadata.latency_ms"
    );
    expect(
      applyCompletion({ before: "{{latency", label: "metadata.latency_ms" })
    ).toBe("{{metadata.latency_ms}}");
    // The braces are already there, so the row takes them back with it rather
    // than writing a second pair.
    expect(
      applyCompletion({
        before: "{{latency",
        after: "}}",
        label: "metadata.latency_ms",
      })
    ).toBe("{{metadata.latency_ms}}");
  });

  it("drills a level per dot in Mustache and stays at the root in f-strings", () => {
    const drilled = complete({ doc: "{{metadata.span.attributes.llm." });

    // Right after the dot: the menu matches the member name alone.
    expect(drilled?.from).toBe(31);
    expect(drilled?.options.map((option) => option.label)).toEqual([
      "model_name",
      "input_messages",
    ]);
    expect(drilled?.options[0]).toMatchObject({
      detail: "gpt-4o-mini",
      section: { name: "metadata.span.attributes.llm" },
    });

    // The server keeps a dotted f-string field as one literal schema property.
    expect(
      complete({
        doc: "{metadata.span.",
        templateFormat: TemplateFormats.FString,
      })
    ).toBeNull();
    const fstring = complete({
      doc: "{",
      templateFormat: TemplateFormats.FString,
    })?.options.map((option) => option.label);
    expect(fstring).toEqual(["input", "output", "metadata"]);
  });

  it("offers repeat blocks for what a block can wrap", () => {
    const repeats = complete({ doc: "{{#metadata.span.attributes.llm." });

    expect(repeats?.options).toMatchObject([
      {
        label: "#metadata.span.attributes.llm.input_messages",
        detail: "1 items",
        section: { name: "Blocks" },
      },
    ]);
  });

  it("names a section's own fields while the cursor is inside it", () => {
    const inSection = complete({
      doc: "{{#metadata.span.attributes.llm.input_messages}}{{",
      sectionStack: ["metadata.span.attributes.llm.input_messages"],
    });

    expect(inSection?.options.map((option) => option.label)).toEqual([
      "role",
      "content",
    ]);
  });
});
