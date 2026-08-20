import { parsePathSegments } from "@phoenix/utils/objectUtils";

import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";

import {
  EVALUATOR_SLOT_NAMES,
  getEvaluatorSlotDefault,
  getEvaluatorSlotSuggestedKeys,
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

  it("pins a shortcut only where the record offers one", () => {
    expect(getEvaluatorSlotSuggestedKeys("span", "input")).toEqual([
      "input_value",
    ]);
    expect(getEvaluatorSlotSuggestedKeys("span", "output")).toEqual([
      "output_value",
    ]);
    expect(getEvaluatorSlotSuggestedKeys("span", "metadata")).toEqual([]);
    for (const slotName of EVALUATOR_SLOT_NAMES) {
      expect(getEvaluatorSlotSuggestedKeys("session", slotName)).toEqual([]);
    }
  });
});
