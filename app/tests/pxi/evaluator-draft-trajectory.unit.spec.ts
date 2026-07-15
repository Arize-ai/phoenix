import { expect, test } from "@playwright/test";

import {
  assertEfficientEvaluatorDraftCalibration,
  EVALUATOR_DRAFT_BASELINES,
} from "./evaluatorDraftTrajectory";
import type { PxiToolCall } from "./types";

function makeEfficientCalls(): PxiToolCall[] {
  return [
    { name: "read_code_evaluator_draft", input: {}, output: {} },
    {
      name: "edit_code_evaluator_draft",
      input: { operations: [{ type: "set_source_code", sourceCode: "..." }] },
      output: { status: "accepted" },
    },
    {
      name: "test_code_evaluator_draft",
      input: {
        cases: [
          { id: "match", testPayload: {} },
          { id: "abstain", testPayload: {} },
          { id: "partial", testPayload: {} },
        ],
      },
      output: JSON.stringify({
        summary: { total: 3, succeeded: 3, failed: 0 },
        cases: [
          { id: "match", result: { label: "match" } },
          { id: "abstain", result: { label: "match" } },
          { id: "partial", result: { label: "mismatch" } },
        ],
      }),
    },
  ];
}

test("accepts one complete ordered evaluator calibration batch", () => {
  expect(() =>
    assertEfficientEvaluatorDraftCalibration({
      toolCalls: makeEfficientCalls(),
      testToolName: "test_code_evaluator_draft",
      baseline: EVALUATOR_DRAFT_BASELINES.code,
      expectedOutcomes: [
        { id: "match", expectedText: "match" },
        { id: "abstain", expectedText: "match" },
        { id: "partial", expectedText: "mismatch" },
      ],
    })
  ).not.toThrow();
});

test("rejects a trajectory that does not beat the pre-fix baseline", () => {
  const calls = makeEfficientCalls();
  expect(() =>
    assertEfficientEvaluatorDraftCalibration({
      toolCalls: calls,
      testToolName: "test_code_evaluator_draft",
      // The efficient trajectory has 2 edit+test calls; a baseline of 2
      // means it failed to improve on the pre-fix loop.
      baseline: { editAndTestCalls: 2 },
      expectedOutcomes: [
        { id: "match", expectedText: "match" },
        { id: "abstain", expectedText: "match" },
        { id: "partial", expectedText: "mismatch" },
      ],
    })
  ).toThrow(/pre-fix baseline of 2 edit\+test calls, observed 2/);
});

test("reports repeated payload edits, incomplete cases, and observed evidence", () => {
  const calls = makeEfficientCalls();
  calls.splice(2, 0, {
    name: "edit_code_evaluator_draft",
    input: { operations: [{ type: "set_test_payload", testPayload: {} }] },
    output: { status: "accepted" },
  });
  calls[3] = {
    ...calls[3],
    input: { cases: [{ id: "match", testPayload: {} }] },
  };
  expect(() =>
    assertEfficientEvaluatorDraftCalibration({
      toolCalls: calls,
      testToolName: "test_code_evaluator_draft",
      expectedOutcomes: [
        { id: "match", expectedText: "match" },
        { id: "abstain", expectedText: "match" },
        { id: "partial", expectedText: "mismatch" },
      ],
    })
  ).toThrow(
    /set_test_payload.*missing input case abstain.*Observed tool sequence/s
  );
});
