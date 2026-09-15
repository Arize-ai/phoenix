import { flushSync } from "react-dom";

import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import { getEvaluatorTaskAnnotation } from "@phoenix/pages/playground/evaluatorCells/evaluatorCellResults";
import type { ExpectedOutput } from "@phoenix/pages/playground/evaluators/evaluatorResults";
import { getExpectedOutputIssue } from "@phoenix/pages/playground/evaluators/evaluatorResults";
import type { PlaygroundStore } from "@phoenix/store/playground";
import { isStringKeyedObject } from "@phoenix/typeUtils";

import type { WaitForEvaluatorTaskHost } from "../playgroundTask/taskSnapshot";
import { EVALUATOR_HOST_TIMEOUT_MS } from "../playgroundTask/taskSnapshot";
import type { PlaygroundTaskResult } from "../playgroundTask/types";
import { resolveEvaluatorInstance } from "./resolveEvaluatorInstance";
import type {
  EditEvaluatorTaskInput,
  EvaluatorTaskAgentHost,
  ReadEvaluatorTaskInput,
  SaveEvaluatorTaskInput,
  SetExpectedOutputInput,
} from "./types";

type EvaluatorTaskActionDeps = {
  playgroundStore: PlaygroundStore;
  waitForEvaluatorHost: WaitForEvaluatorTaskHost;
};

/**
 * The adapter of the evaluator task an operation addresses. The editor
 * registers it a render after the task lands, so it is awaited rather than
 * looked up.
 */
async function resolveEvaluatorTaskHost(
  { playgroundStore, waitForEvaluatorHost }: EvaluatorTaskActionDeps,
  instanceId: number | undefined
): Promise<PlaygroundTaskResult<EvaluatorTaskAgentHost>> {
  const resolved = resolveEvaluatorInstance(
    playgroundStore.getState(),
    instanceId
  );
  if (!resolved.ok) {
    return resolved;
  }
  const host = await waitForEvaluatorHost(
    resolved.output.instance.id,
    EVALUATOR_HOST_TIMEOUT_MS
  );
  if (!host) {
    return {
      ok: false,
      error: `The editor of evaluator task ${resolved.output.label} has not finished loading. Wait for the page to settle and try again.`,
    };
  }
  return { ok: true, output: host };
}

/** Creates the handler for `playground.evaluator.read`. */
export function createReadEvaluatorTaskClientAction(
  deps: EvaluatorTaskActionDeps
) {
  return async ({
    instanceId,
  }: ReadEvaluatorTaskInput): Promise<UIOperationResult> => {
    const host = await resolveEvaluatorTaskHost(deps, instanceId);
    return host.ok ? { ok: true, output: host.output.read() } : host;
  };
}

/** Creates the handler for `playground.evaluator.edit`. */
export function createEditEvaluatorTaskClientAction(
  deps: EvaluatorTaskActionDeps
) {
  return async ({
    instanceId,
    ...edit
  }: EditEvaluatorTaskInput): Promise<UIOperationResult> => {
    const host = await resolveEvaluatorTaskHost(deps, instanceId);
    if (!host.ok) {
      return host;
    }
    // Commit the edit's React updates before returning, so an operation that
    // follows (run, save, read) sees the edited task mirrored on the instance.
    return flushSync(() => host.output.edit(edit));
  };
}

/** Creates the handler for `playground.evaluator.save`. */
export function createSaveEvaluatorTaskClientAction(
  deps: EvaluatorTaskActionDeps
) {
  return async ({
    instanceId,
    expectedRevision,
    asNew = false,
  }: SaveEvaluatorTaskInput): Promise<UIOperationResult> => {
    const host = await resolveEvaluatorTaskHost(deps, instanceId);
    return host.ok ? host.output.save(expectedRevision, { asNew }) : host;
  };
}

/** A loaded dataset example as the table's rows carry it. */
export type ExpectedOutputExampleRow = { id: string; revisionId: string };

/** Writes one expected output at once, bypassing the table's batching delay. */
export type SaveExpectedOutputNow = (
  exampleId: string,
  annotationName: string,
  output: ExpectedOutput | null
) => Promise<UIOperationResult>;

/** The expected output the input records; null when every field is null. */
function toExpectedOutput(
  input: SetExpectedOutputInput
): ExpectedOutput | null {
  if (input.label == null && input.score == null && input.explanation == null) {
    return null;
  }
  return {
    label: input.label,
    score: input.score ?? null,
    explanation: input.explanation ?? null,
  };
}

/**
 * Creates the handler for `playground.expectedOutput.set`. Mounted by the
 * dataset examples table, which holds the rows' revision ids and the
 * expected-output writer.
 */
export function createSetExpectedOutputClientAction({
  playgroundStore,
  getExamples,
  saveNow,
}: {
  playgroundStore: PlaygroundStore;
  getExamples: () => ReadonlyArray<ExpectedOutputExampleRow>;
  saveNow: SaveExpectedOutputNow;
}) {
  return async (input: SetExpectedOutputInput): Promise<UIOperationResult> => {
    const resolved = resolveEvaluatorInstance(
      playgroundStore.getState(),
      input.instanceId
    );
    if (!resolved.ok) {
      return resolved;
    }
    const { evaluator, index } = resolved.output;
    const annotation = getEvaluatorTaskAnnotation({
      evaluator,
      position: index,
    });
    const example = getExamples().find((row) => row.id === input.exampleId);
    if (!example) {
      return {
        ok: false,
        error: `Example ${input.exampleId} is not among the loaded dataset examples. Read the run's results for the current example ids.`,
        code: "NOT_FOUND",
      };
    }
    if (example.revisionId !== input.expectedRevisionId) {
      return {
        ok: false,
        error: `expectedRevisionId "${input.expectedRevisionId}" does not match example ${input.exampleId}'s current revision "${example.revisionId}". Retry with the current revision id.`,
        code: "STALE_REVISION",
      };
    }
    const output = toExpectedOutput(input);
    const issue = output
      ? getExpectedOutputIssue({ expected: output, output: annotation.output })
      : null;
    if (issue) {
      return {
        ok: false,
        error: `${issue} The output's labels are: ${annotation.output?.labels.join(", ") ?? "(none)"}.`,
      };
    }
    const written = await saveNow(input.exampleId, annotation.name, output);
    if (!written.ok) {
      return written;
    }
    return {
      ok: true,
      output: {
        exampleId: input.exampleId,
        annotationName: annotation.name,
        ...(isStringKeyedObject(written.output) ? written.output : {}),
      },
    };
  };
}
