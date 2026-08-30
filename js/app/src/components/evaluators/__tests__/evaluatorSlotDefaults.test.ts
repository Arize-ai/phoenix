import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  getGenericSessionEvaluationContext,
  getSampleSessionEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import {
  getGenericSpanEvaluationContext,
  getSampleSpanEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";

import { materializeEvaluatorContext } from "../evaluatorContext";
import { resolveEvaluatorPath } from "../evaluatorPathCompletions";
import type { EvaluatorSlotName } from "../evaluatorSlotDefaults";
import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotSuggestedPaths,
} from "../evaluatorSlotDefaults";

const GRAINS: ProjectEvaluatorMappingSourceGrain[] = ["span", "session"];

const genericContextFor = (grain: ProjectEvaluatorMappingSourceGrain) =>
  (grain === "span"
    ? getGenericSpanEvaluationContext()
    : getGenericSessionEvaluationContext()
  ).context as unknown as Record<string, unknown>;

const sampleContextFor = (grain: ProjectEvaluatorMappingSourceGrain) =>
  (grain === "span"
    ? getSampleSpanEvaluationContext()
    : getSampleSessionEvaluationContext()
  ).context as unknown as Record<string, unknown>;

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
          resolveEvaluatorPath({ source: genericContextFor(grain), path })
        ).toMatchObject({ status: "resolved" });
      }
    }
  });

  it("pins worked examples of what each slot's mapping can reach", () => {
    const paths = (grain: "span" | "session", slotName: EvaluatorSlotName) =>
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
