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
  getEvaluatorSlotDefault,
  getEvaluatorSlotDefaults,
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
    ? getSampleSpanEvaluationContext("")
    : getSampleSessionEvaluationContext()
  ).context as unknown as Record<string, unknown>;

const defaultPathsFor = (grain: ProjectEvaluatorMappingSourceGrain) =>
  EVALUATOR_SLOT_NAMES.map(
    (slotName) => getEvaluatorSlotDefault(grain, slotName).path
  );

/**
 * What each slot's default used to name: the record field the context happens
 * to have copied the slot's value from. The identity default has to reach the
 * same value, or moving to it would quietly change what an unmapped slot binds.
 */
const RECORD_PATHS: Record<
  ProjectEvaluatorMappingSourceGrain,
  Record<EvaluatorSlotName, string>
> = {
  span: {
    input: "metadata.span.input_value",
    output: "metadata.span.output_value",
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
    slotDefaults: getEvaluatorSlotDefaults(grain),
  })?.values[slotName];

describe("evaluator slot defaults", () => {
  // The ghost in the field is the only place these are written down, so
  // changing one changes what an author is told an unmapped slot will read.
  // An unmapped slot binds the context key of its own name, so every default
  // is that name — never a `metadata.…` path that happens to hold the same
  // value.
  it("names the path every slot falls back to", () => {
    expect(defaultPathsFor("span")).toEqual(["input", "output", "metadata"]);
    expect(defaultPathsFor("session")).toEqual(["input", "output", "metadata"]);
  });

  // `input` and `output` are independent bindings whose values the record also
  // publishes under a name of its own. Saying so in the ghost is only safe
  // while the two agree, so the agreement is checked rather than assumed.
  it("binds what the record path it replaced bound", () => {
    for (const grain of GRAINS) {
      for (const slotName of EVALUATOR_SLOT_NAMES) {
        expect(boundValue(grain, slotName)).toEqual(
          boundValue(grain, slotName, RECORD_PATHS[grain][slotName])
        );
      }
    }
  });

  // A default is shown as a path an author could have typed, so it has to be
  // one: a ghost that resolves to nothing teaches a path that would fail.
  it("keeps every default a path the context actually holds", () => {
    for (const grain of GRAINS) {
      for (const path of defaultPathsFor(grain)) {
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
      "metadata.span.input_value",
      "metadata.span.attributes.llm.input_messages",
      "metadata.span.attributes.input",
    ]);
    expect(paths("span", "output")).toEqual([
      "metadata.span.output_value",
      "metadata.span.attributes.llm.output_messages",
    ]);
    expect(paths("span", "metadata")).toEqual([
      "metadata.span.attributes",
      "metadata.span.attributes.llm",
    ]);
    expect(paths("session", "input")).toEqual([
      "metadata.session.turns",
      "metadata.session.turns[0].input",
    ]);
    expect(paths("session", "output")).toEqual([
      "metadata.session.turns[0].output",
    ]);
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
