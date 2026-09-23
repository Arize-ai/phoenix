import { judge } from "./judge";
import type { JudgeOutcome } from "./judge";

const MAX_PLAYWRIGHT_ERROR_LENGTH = 1_000;
const ESCAPE_CHARACTER = String.fromCharCode(27);
const CSI_SEQUENCE_PATTERN = /^\[[0-?]*[ -/]*[@-~]/;

type JudgeInput = {
  system?: string;
  prompt: string;
  assistantText: string;
  rubric: string[];
};

type PxiOutcome = {
  judgeResult: JudgeOutcome;
  assertionFailure?: unknown;
};

function stripAnsi(message: string) {
  const [firstPart, ...escapedParts] = message.split(ESCAPE_CHARACTER);
  return [
    firstPart,
    ...escapedParts.map((part) => part.replace(CSI_SEQUENCE_PATTERN, "")),
  ].join("");
}

function getSanitizedErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const withoutAnsi = stripAnsi(message);
  if (withoutAnsi.length <= MAX_PLAYWRIGHT_ERROR_LENGTH) {
    return withoutAnsi;
  }
  return `${withoutAnsi.slice(0, MAX_PLAYWRIGHT_ERROR_LENGTH)}...`;
}

function getFailureExplanation({
  judgeExplanation,
  assertionError,
}: {
  judgeExplanation: string;
  assertionError?: string;
}) {
  if (!assertionError) {
    return judgeExplanation;
  }
  return `Judge explanation: ${judgeExplanation}\n\nPlaywright assertion: ${assertionError}`;
}

/**
 * Runs deterministic assertions and LLM judging while preserving enough context
 * to persist failed PXI turns as Phoenix experiment runs before rethrowing.
 * @param params.assertions - Deterministic Playwright assertions for the PXI turn.
 * @param params.judgeInput - Inputs for the reusable AI SDK judge.
 */
export async function evaluatePxiOutcome({
  assertions,
  judgeInput,
}: {
  assertions: () => Promise<void> | void;
  judgeInput: JudgeInput;
}): Promise<PxiOutcome> {
  let assertionFailure: unknown;
  let assertionError: string | undefined;
  let judgeResult: JudgeOutcome = {
    label: "fail",
    score: 0,
    explanation: "PXI outcome was not judged.",
  };

  try {
    await assertions();
  } catch (error) {
    assertionFailure = error;
    assertionError = getSanitizedErrorMessage(error);
  }

  try {
    judgeResult = await judge(judgeInput);
  } catch (error) {
    assertionFailure ??= error;
    judgeResult = {
      label: "fail",
      score: 0,
      explanation: getSanitizedErrorMessage(error),
    };
  }

  if (assertionError || judgeResult.label === "fail") {
    judgeResult = {
      ...judgeResult,
      label: "fail",
      score: 0,
      explanation: getFailureExplanation({
        judgeExplanation: judgeResult.explanation,
        assertionError,
      }),
    };
  }

  return { judgeResult, assertionFailure };
}

export function assertPxiOutcome(outcome: PxiOutcome) {
  if (outcome.assertionFailure) {
    throw outcome.assertionFailure;
  }
  if (outcome.judgeResult.label !== "pass") {
    throw new Error(outcome.judgeResult.explanation);
  }
}
