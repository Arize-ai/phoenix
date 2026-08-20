import type { ProjectEvaluatorMappingSourceGrain } from "@phoenix/pages/project/evaluators/projectEvaluatorTypes";
import { parsePathSegments } from "@phoenix/utils/objectUtils";

import type { EvaluatorSlotName } from "../evaluatorSlotDefaults";
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
    const paths = (grain: "span" | "session", slotName: EvaluatorSlotName) =>
      getEvaluatorSlotSuggestedPaths(grain, slotName).map(({ path }) => path);

    expect(paths("span", "input")).toEqual([
      "input_value",
      "attributes.llm.input_messages",
      "attributes.input",
    ]);
    expect(paths("span", "output")).toEqual([
      "output_value",
      "attributes.llm.output_messages",
    ]);
    expect(paths("span", "metadata")).toEqual(["attributes", "attributes.llm"]);
    expect(paths("session", "input")).toEqual(["turns", "turns[0].input"]);
    expect(paths("session", "output")).toEqual(["turns[0].output"]);
    expect(paths("session", "metadata")).toEqual([]);
  });

  it("describes every suggestion, and never in path notation", () => {
    for (const grain of ["span", "session"] as const) {
      for (const slotName of EVALUATOR_SLOT_NAMES) {
        for (const { description } of getEvaluatorSlotSuggestedPaths(
          grain,
          slotName
        )) {
          expect(description).not.toBe("");
          expect(parsePathSegments(description)).toBeNull();
        }
      }
    }
  });
});
