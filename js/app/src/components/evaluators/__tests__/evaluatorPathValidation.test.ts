import { describe, expect, it } from "vitest";

import { SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT } from "@phoenix/store/evaluatorStore";

import { materializeEvaluatorContext } from "../evaluatorContext";
import {
  getEvaluatorPathError,
  INVALID_PATH_MESSAGE,
  UNRESOLVED_PATH_MESSAGE,
} from "../evaluatorPathValidation";

const SAMPLED_SPAN_SOURCE = {
  input: { messages: [{ role: "user", content: "hi" }] },
  output: "hello",
  metadata: { span_kind: "LLM", name: "chat", attributes: {} },
};

/** The span skeleton as the form sees it before the bench binds a record. */
const SKELETON_HAS_SAMPLED_RECORD = materializeEvaluatorContext({
  recordKind: "span",
  evaluatorMappingSource: {
    recordKind: "span",
    source: SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT,
  },
  inputMapping: { pathMapping: {}, literalMapping: {} },
})?.hasSampledRecord;

describe("getEvaluatorPathError", () => {
  it("does not flag a path as missing while no record has been sampled", () => {
    expect(SKELETON_HAS_SAMPLED_RECORD).toBe(false);
    expect(
      getEvaluatorPathError({
        source: SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT,
        path: "metadata.span_kind",
        hasSampledRecord: false,
      })
    ).toBeNull();
    expect(
      getEvaluatorPathError({
        source: SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT,
        path: "input.messages[0].content",
        hasSampledRecord: false,
      })
    ).toBeNull();
  });

  it("flags a path that reads nothing on a sampled record", () => {
    const path = "metadata.nope";
    expect(
      getEvaluatorPathError({
        source: SAMPLED_SPAN_SOURCE,
        path,
        hasSampledRecord: true,
      })
    ).toEqual({
      status: "unresolved",
      errorMessage: UNRESOLVED_PATH_MESSAGE,
      range: { from: 9, to: 13 },
    });
    expect(path.slice(9, 13)).toBe("nope");
  });

  it("passes a path that reads a value on a sampled record", () => {
    expect(
      getEvaluatorPathError({
        source: SAMPLED_SPAN_SOURCE,
        path: "input.messages[0].content",
        hasSampledRecord: true,
      })
    ).toBeNull();
  });

  it("flags a path the server would reject whether or not a record is sampled", () => {
    const path = "metadata.events.0";
    const expected = {
      status: "invalid",
      errorMessage: INVALID_PATH_MESSAGE,
      range: { from: 16, to: 17 },
    };
    expect(
      getEvaluatorPathError({
        source: SPAN_EVALUATOR_MAPPING_SOURCE_DEFAULT,
        path,
        hasSampledRecord: false,
      })
    ).toEqual(expected);
    expect(
      getEvaluatorPathError({
        source: SAMPLED_SPAN_SOURCE,
        path,
        hasSampledRecord: true,
      })
    ).toEqual(expected);
  });

  it("passes an empty path", () => {
    expect(
      getEvaluatorPathError({
        source: SAMPLED_SPAN_SOURCE,
        path: "",
        hasSampledRecord: true,
      })
    ).toBeNull();
  });
});
