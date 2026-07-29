import type { PxiToolCall } from "./types";

/**
 * Pre-fix baselines measured from the two source `pxi_dev` authoring traces
 * (see Arize-ai/phoenix#14359): code evaluator 0a6c4738a4a7b39e5b7256e7dad4546d,
 * LLM evaluator 5a40eebb1441b8eefc926aa7b7d6bebe. A batched calibration must
 * use strictly fewer edit+test calls than these serial payload-swap loops did.
 * `durationMs` is recorded for before/after reporting only (wall-clock against
 * a live LLM is too flaky to assert on).
 */
export const EVALUATOR_DRAFT_BASELINES = {
  code: { editAndTestCalls: 7, durationMs: 195_200 },
  llm: { editAndTestCalls: 8, durationMs: 238_600 },
} as const;

type ExpectedCaseOutcome = {
  id: string;
  expectedText: string;
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function findObjectWithCases(
  value: unknown,
  depth = 0
): Record<string, unknown> | null {
  if (depth > 4) {
    return null;
  }
  const parsed = parseJson(value);
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findObjectWithCases(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const candidate = parsed as Record<string, unknown>;
  if (Array.isArray(candidate.cases)) {
    return candidate;
  }
  for (const nested of Object.values(candidate)) {
    const found = findObjectWithCases(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

function hasSetTestPayloadOperation(toolCall: PxiToolCall): boolean {
  if (!toolCall.name.startsWith("edit_") || toolCall.input == null) {
    return false;
  }
  const serializedInput = JSON.stringify(toolCall.input);
  return serializedInput.includes('"type":"set_test_payload"');
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  const parsed = parseJson(value);
  if (typeof parsed === "string") return [parsed];
  if (Array.isArray(parsed)) {
    return parsed.flatMap((item) => collectStrings(item, depth + 1));
  }
  if (typeof parsed === "object" && parsed !== null) {
    return Object.values(parsed).flatMap((item) =>
      collectStrings(item, depth + 1)
    );
  }
  return [];
}

function formatEvidence({
  toolCalls,
  testToolName,
}: {
  toolCalls: PxiToolCall[];
  testToolName: string;
}): string {
  const observedSequence = toolCalls
    .map((toolCall) => toolCall.name)
    .join(" -> ");
  const testCalls = toolCalls
    .filter((toolCall) => toolCall.name === testToolName)
    .map((toolCall) => ({ input: toolCall.input, output: toolCall.output }));
  return `Observed tool sequence: ${observedSequence || "(none)"}. Test calls: ${JSON.stringify(testCalls)}`;
}

/**
 * Asserts that PXI calibrated an evaluator with one complete named batch.
 * Failures include the observed sequence and test arguments/results so tool
 * misuse can be distinguished from evaluator-quality failures.
 */
export function assertEfficientEvaluatorDraftCalibration({
  toolCalls,
  testToolName,
  expectedOutcomes,
  maximumToolCalls = 10,
  baseline,
}: {
  toolCalls: PxiToolCall[];
  testToolName: "test_code_evaluator_draft" | "test_llm_evaluator_draft";
  expectedOutcomes: ExpectedCaseOutcome[];
  maximumToolCalls?: number;
  /** Pre-fix edit+test call count the batched trajectory must beat. */
  baseline?: { editAndTestCalls: number };
}): void {
  const errors: string[] = [];
  const testCalls = toolCalls.filter(
    (toolCall) => toolCall.name === testToolName
  );
  if (testCalls.length !== 1) {
    errors.push(
      `expected exactly one ${testToolName} call, observed ${testCalls.length}`
    );
  }
  if (baseline) {
    const editAndTestCalls = toolCalls.filter(
      (toolCall) =>
        toolCall.name.startsWith("edit_") || toolCall.name === testToolName
    ).length;
    if (editAndTestCalls >= baseline.editAndTestCalls) {
      errors.push(
        `expected fewer than the pre-fix baseline of ${baseline.editAndTestCalls} edit+test calls, observed ${editAndTestCalls}`
      );
    }
  }
  if (toolCalls.length > maximumToolCalls) {
    errors.push(
      `expected at most ${maximumToolCalls} tool calls, observed ${toolCalls.length}`
    );
  }
  const payloadEditCount = toolCalls.filter(hasSetTestPayloadOperation).length;
  if (payloadEditCount > 0) {
    errors.push(
      `expected payload overrides in the batch test call, observed ${payloadEditCount} set_test_payload edit(s)`
    );
  }

  const testCall = testCalls[0];
  const batchInput = findObjectWithCases(testCall?.input);
  const inputCases = Array.isArray(batchInput?.cases) ? batchInput.cases : [];
  const inputIds = inputCases.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const id = (item as { id?: unknown }).id;
    return typeof id === "string" ? [id] : [];
  });
  const uniqueInputIds = new Set(inputIds);
  if (inputCases.length < expectedOutcomes.length) {
    errors.push(
      `expected at least ${expectedOutcomes.length} named cases, observed ${inputCases.length}`
    );
  }
  if (uniqueInputIds.size !== inputIds.length) {
    errors.push("expected unique case IDs in the batched test input");
  }
  for (const expected of expectedOutcomes) {
    if (!uniqueInputIds.has(expected.id)) {
      errors.push(`missing input case ${expected.id}`);
    }
  }

  const batchOutput = findObjectWithCases(testCall?.output);
  const outputCases = Array.isArray(batchOutput?.cases)
    ? batchOutput.cases
    : [];
  for (const expected of expectedOutcomes) {
    const outputCase = outputCases.find((item) => {
      return (
        typeof item === "object" &&
        item !== null &&
        (item as { id?: unknown }).id === expected.id
      );
    });
    if (!outputCase) {
      errors.push(`missing output case ${expected.id}`);
      continue;
    }
    const outcomeStrings = collectStrings(outputCase).map((value) =>
      value.toLowerCase()
    );
    if (!outcomeStrings.includes(expected.expectedText.toLowerCase())) {
      errors.push(
        `case ${expected.id} did not contain expected outcome ${JSON.stringify(expected.expectedText)}`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `${errors.join("; ")}. ${formatEvidence({ toolCalls, testToolName })}`
    );
  }
}
