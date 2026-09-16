import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { getSampleSessionEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import { getSampleSpanEvaluationContext } from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";
import { getSampleTraceEvaluationContext } from "@phoenix/pages/project/evaluators/sampleTraceEvaluationContext";

import { materializeEvaluatorContext } from "../evaluatorContext";
import { resolveEvaluatorPath } from "../evaluatorPathCompletions";
import type { EvaluatorSlotName } from "../evaluatorSlotDefaults";
import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotSuggestedPaths,
} from "../evaluatorSlotDefaults";

/**
 * Where each grain's sample record comes from. A grain added to the union
 * fails to compile here until it supplies its own, rather than silently being
 * checked against another grain's.
 */
const SAMPLE_CONTEXT_BY_GRAIN: Record<
  ProjectEvaluatorMappingSourceGrain,
  () => { context: unknown }
> = {
  span: getSampleSpanEvaluationContext,
  trace: getSampleTraceEvaluationContext,
  session: getSampleSessionEvaluationContext,
};

const GRAINS = Object.keys(
  SAMPLE_CONTEXT_BY_GRAIN
) as ProjectEvaluatorMappingSourceGrain[];

const sampleContextFor = (grain: ProjectEvaluatorMappingSourceGrain) =>
  SAMPLE_CONTEXT_BY_GRAIN[grain]().context as Record<string, unknown>;

/**
 * The record path that publishes the same value a slot's identity default
 * binds. The identity default has to reach the same value, or moving to it
 * would quietly change what an unmapped slot binds. Span `input`/`output`
 * have no such path: they are the example conversion's extraction (messages
 * for an LLM span), a derivation rather than a copy of one record field.
 */
const RECORD_PATHS: Record<
  ProjectEvaluatorMappingSourceGrain,
  Partial<Record<EvaluatorSlotName, string>>
> = {
  span: {
    metadata: "metadata",
  },
  trace: {
    metadata: "metadata",
  },
  session: {
    input: "metadata.first_input",
    output: "metadata.last_output",
    metadata: "metadata",
  },
};

const boundValue = (
  grain: ProjectEvaluatorMappingSourceGrain,
  slotName: EvaluatorSlotName,
  path?: string
) =>
  materializeEvaluatorContext({
    grain,
    evaluatorMappingSource: {
      grain,
      source: sampleContextFor(grain) as never,
    },
    inputMapping: {
      pathMapping: path ? { [slotName]: path } : {},
      literalMapping: {},
    },
  })?.values[slotName];

describe("evaluator slot defaults", () => {
  // `input` and `output` are independent bindings whose values the record also
  // publishes under a name of its own. Saying so in the ghost is only safe
  // while the two agree, so the agreement is checked rather than assumed.
  it("binds what the record path it replaced bound", () => {
    for (const grain of GRAINS) {
      for (const slotName of EVALUATOR_SLOT_NAMES) {
        const recordPath = RECORD_PATHS[grain][slotName];
        if (recordPath === undefined) {
          continue;
        }
        expect(boundValue(grain, slotName)).toEqual(
          boundValue(grain, slotName, recordPath)
        );
      }
    }
  });

  // An unmapped slot binds the context key of its own name; the ghost shows
  // that name as a path, so it has to be one the context actually holds.
  it("keeps every slot name a path the context actually holds", () => {
    for (const grain of GRAINS) {
      for (const path of EVALUATOR_SLOT_NAMES) {
        expect(
          resolveEvaluatorPath({ source: sampleContextFor(grain), path })
        ).toMatchObject({ status: "resolved" });
      }
    }
  });

  it("pins worked examples of what each slot's mapping can reach", () => {
    const paths = (
      grain: ProjectEvaluatorMappingSourceGrain,
      slotName: EvaluatorSlotName
    ) =>
      getEvaluatorSlotSuggestedPaths(grain, slotName).map(({ path }) => path);

    expect(paths("span", "input")).toEqual([
      "metadata.attributes.llm.input_messages",
      "metadata.attributes.input",
    ]);
    expect(paths("span", "output")).toEqual([
      "metadata.attributes.llm.output_messages",
    ]);
    expect(paths("span", "metadata")).toEqual([
      "metadata.attributes",
      "metadata.attributes.llm",
      "metadata.annotations",
    ]);
    expect(paths("session", "input")).toEqual([
      "metadata.turns",
      "metadata.turns[0].input",
    ]);
    expect(paths("session", "output")).toEqual(["metadata.turns[0].output"]);
    expect(paths("session", "metadata")).toEqual([]);
    expect(paths("trace", "input")).toEqual(["metadata.attributes.input"]);
    expect(paths("trace", "output")).toEqual(["metadata.attributes.output"]);
    expect(paths("trace", "metadata")).toEqual([
      "metadata.attributes",
      "metadata.trace_annotations",
    ]);
  });

  it("suggests only paths a real record resolves", () => {
    for (const grain of GRAINS) {
      for (const slotName of EVALUATOR_SLOT_NAMES) {
        for (const { path, description } of getEvaluatorSlotSuggestedPaths(
          grain,
          slotName
        )) {
          expect(description).not.toBe("");
          expect(
            resolveEvaluatorPath({ source: sampleContextFor(grain), path })
          ).toMatchObject({ status: "resolved" });
        }
      }
    }
  });
});
