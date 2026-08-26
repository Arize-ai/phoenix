import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import {
  getGenericSessionEvaluationContext,
  getSampleSessionEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSessionEvaluationContext";
import {
  getGenericSpanEvaluationContext,
  getSampleSpanEvaluationContext,
} from "@phoenix/pages/project/evaluators/sampleSpanEvaluationContext";

import { resolveEvaluatorPath } from "../evaluatorPathCompletions";
import type { EvaluatorSlotName } from "../evaluatorSlotDefaults";
import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotDefault,
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

describe("evaluator slot defaults", () => {
  // The ghost in the field is the only place these are written down, so
  // changing one changes what an author is told an unmapped slot will read.
  it("names the path every slot falls back to", () => {
    expect(defaultPathsFor("span")).toEqual([
      "metadata.span.input_value",
      "metadata.span.output_value",
      "metadata",
    ]);
    expect(defaultPathsFor("session")).toEqual([
      "metadata.first_input",
      "metadata.last_output",
      "metadata",
    ]);
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
