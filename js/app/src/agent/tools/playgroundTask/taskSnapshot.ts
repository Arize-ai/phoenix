import type { UIOperationResult } from "@phoenix/agent/uiOperations/types";
import type { PlaygroundStore } from "@phoenix/store/playground";
import { selectPlaygroundInstance } from "@phoenix/store/playground/selectors";

import type { EvaluatorTaskAgentHost } from "../playgroundEvaluator/types";
import { getPromptSnapshot } from "../playgroundPrompt/promptStore";

/**
 * Resolves with the PXI adapter an evaluator task's editor registered, or
 * null when none registers within `timeoutMs`.
 */
export type WaitForEvaluatorTaskHost = (
  instanceId: number,
  timeoutMs: number
) => Promise<EvaluatorTaskAgentHost | null>;

/** How long an evaluator task's editor may take to mount once its task landed. */
export const EVALUATOR_HOST_TIMEOUT_MS = 15_000;

/**
 * The instance as the read operation of its kind reports it: the
 * `playground.prompt.read` snapshot for a prompt task, the
 * `playground.evaluator.read` snapshot for an evaluator task. The evaluator
 * editor mounts a render after its task lands, so its adapter is awaited.
 */
export async function readTaskSnapshot({
  playgroundStore,
  instanceId,
  waitForEvaluatorHost,
}: {
  playgroundStore: PlaygroundStore;
  instanceId: number;
  waitForEvaluatorHost: WaitForEvaluatorTaskHost;
}): Promise<UIOperationResult> {
  const instance = selectPlaygroundInstance(instanceId)(
    playgroundStore.getState()
  );

  if (!instance) {
    return {
      ok: false,
      error: `Playground instance ${instanceId} was not found.`,
      code: "NOT_FOUND",
    };
  }

  if (instance.task.kind === "prompt") {
    return getPromptSnapshot({ playgroundStore, instanceId });
  }

  const host = await waitForEvaluatorHost(
    instanceId,
    EVALUATOR_HOST_TIMEOUT_MS
  );

  if (!host) {
    return {
      ok: false,
      error: `The evaluator editor for instance ${instanceId} did not finish loading. Call playground.evaluator.read once the page settles.`,
    };
  }

  return { ok: true, output: host.read() };
}
