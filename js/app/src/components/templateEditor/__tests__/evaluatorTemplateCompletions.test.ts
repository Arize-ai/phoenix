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
  attributes: {
    llm: {
      model_name: "gpt-4o-mini",
      input_messages: [{ role: "user", content: "Why?" }],
      "invocation.parameters": { temperature: 0 },
    },
  },
};

function buildContext(grain: ProjectEvaluatorMappingSourceGrain) {
  const record = { ...SPAN_RECORD, output_value: "Because." };
  return materializeEvaluatorContext({
    grain,
    evaluatorMappingSource:
      grain === "span"
        ? {
            grain,
            source: { input: SPAN_RECORD, output: "Because.", span: record },
          }
        : {
            grain,
            source: { input: SPAN_RECORD, output: "Because.", session: record },
          },
    inputMapping: { pathMapping: {}, literalMapping: {} },
    slotDefaults: getEvaluatorSlotDefaults(grain),
    recordVariableValues:
      grain === "span" ? { latency_ms: 842.5 } : { first_input: "Hello" },
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
        detail: "← span",
        section: { name: "Evaluator input", rank: 1 },
      },
      {
        label: "output",
        detail: "← span.output_value",
        section: { name: "Evaluator input", rank: 1 },
      },
      {
        label: "metadata",
        detail: "not set",
        section: { name: "Evaluator input", rank: 1 },
      },
    ]);
    expect(
      spanResult?.options.find((option) => option.label === "latency_ms")
    ).toMatchObject({ detail: "842.5", section: { name: "From the span" } });

    expect(
      complete({ doc: "{{", grain: "session" })?.options.find(
        (option) => option.label === "first_input"
      )
    ).toMatchObject({ section: { name: "From the session" } });
  });

  it("drills a level per dot in Mustache and stays at the root in f-strings", () => {
    const drilled = complete({ doc: "{{input.attributes.llm." });

    // Right after the dot: the menu matches the member name alone.
    expect(drilled?.from).toBe(23);
    expect(drilled?.options.map((option) => option.label)).toEqual([
      "model_name",
      "input_messages",
    ]);
    expect(drilled?.options[0]).toMatchObject({
      detail: "gpt-4o-mini",
      section: { name: "input.attributes.llm" },
    });

    // The server keeps a dotted f-string field as one literal schema property.
    expect(
      complete({
        doc: "{input.attributes.",
        templateFormat: TemplateFormats.FString,
      })
    ).toBeNull();
    expect(
      complete({
        doc: "{",
        templateFormat: TemplateFormats.FString,
      })?.options.map((option) => option.label)
    ).toContain("input");
  });

  it("offers repeat and empty blocks for what a block can wrap", () => {
    const repeats = complete({ doc: "{{#input.attributes.llm." });

    expect(repeats?.options).toMatchObject([
      {
        label: "#input.attributes.llm.input_messages",
        detail: "1 items",
        section: { name: "Blocks" },
      },
    ]);
    expect(
      complete({ doc: "{{^" })?.options.map((option) => ({
        label: option.label,
        detail: option.detail,
      }))
    ).toContainEqual({ label: "^metadata", detail: "if empty" });
  });

  it("names a section's own fields while the cursor is inside it", () => {
    const inSection = complete({
      doc: "{{#input.attributes.llm.input_messages}}{{",
      sectionStack: ["input.attributes.llm.input_messages"],
    });

    expect(inSection?.options.map((option) => option.label)).toEqual([
      "role",
      "content",
    ]);
  });
});
