import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { parsePathSegments } from "@phoenix/utils/objectUtils";

import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotDefault,
  getEvaluatorSlotSuggestedPaths,
} from "../evaluatorSlotDefaults";

const GRAINS: ProjectEvaluatorMappingSourceGrain[] = ["span", "session"];

const defaultsFor = (grain: ProjectEvaluatorMappingSourceGrain) =>
  EVALUATOR_SLOT_NAMES.map((slotName) =>
    getEvaluatorSlotDefault(grain, slotName)
  );

describe("evaluator slot defaults", () => {
  // The ghost in the field is the only place these are written down, so
  // changing one changes what an author is told an unmapped slot will read.
  it("names what every slot falls back to", () => {
    expect(defaultsFor("span")).toEqual([
      { kind: "path", path: "span" },
      { kind: "path", path: "span.output_value" },
      null,
    ]);
    expect(defaultsFor("session")).toEqual([
      { kind: "path", path: "session" },
      { kind: "derived", description: "last turn's output" },
      null,
    ]);
  });

  // A derived default is assembled from the record, so there is no path that
  // reads it. Describing one in path notation would invite an author to type
  // something that resolves to nothing.
  it("keeps a derived default from reading as a path", () => {
    const derived = GRAINS.flatMap(defaultsFor).filter(
      (slotDefault) => slotDefault?.kind === "derived"
    );

    expect(derived).not.toHaveLength(0);
    for (const slotDefault of derived) {
      expect(parsePathSegments(slotDefault.description)).toBeNull();
    }
  });

  it("pins worked examples of what each slot's mapping can reach", () => {
    expect(getEvaluatorSlotSuggestedPaths("span", "input")).toEqual([
      "input_value",
      "attributes.llm.input_messages",
      "attributes.input",
    ]);
    expect(getEvaluatorSlotSuggestedPaths("span", "output")).toEqual([
      "output_value",
      "attributes.llm.output_messages",
    ]);
    expect(getEvaluatorSlotSuggestedPaths("span", "metadata")).toEqual([
      "attributes",
      "attributes.llm",
    ]);
    expect(getEvaluatorSlotSuggestedPaths("session", "input")).toEqual([
      "turns",
      "turns[0].input",
    ]);
    expect(getEvaluatorSlotSuggestedPaths("session", "output")).toEqual([
      "turns[0].output",
    ]);
    expect(getEvaluatorSlotSuggestedPaths("session", "metadata")).toEqual([]);
  });
});
