import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import {
  buildPromptToolsDisplaySnapshot,
  computePromptToolsWriteSummary,
} from "./diffSummary";
import {
  parsePromptToolsActionContext,
  parseReadPromptToolsInput,
  parseWritePromptToolsInput,
} from "./parsers";
import { bindPendingPromptToolWriteActions } from "./pendingPromptToolWrite";
import {
  getPromptToolsSnapshot,
  planWritePromptTools,
} from "./promptToolsStore";
import type { PendingPromptToolWrite } from "./types";

/** Returns the current prompt tool list snapshot as JSON. */
export function createReadPromptToolsClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadPromptToolsInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid read_prompt_tools input." };
    }
    const snapshot = getPromptToolsSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!snapshot.ok) return snapshot;
    return { ok: true, output: JSON.stringify(snapshot.output, null, 2) };
  };
}

/**
 * Proposes a batch of function-tool create/update/delete operations on a
 * playground prompt instance. Validates the batch against the current revision
 * up front (so an invalid batch fails fast with its indexed error, never a diff
 * that then fails on accept), materializes a before/after diff in the provider
 * display format the editor shows, and registers a pending edit for user
 * approval — mirroring `edit_prompt_instance`. With auto-accept on
 * (`permissions.edits === "bypass"`), the batch is applied immediately.
 */
export function createWritePromptToolsClientAction({
  playgroundStore,
  setPendingPromptToolWrite,
  shouldAutoAccept = () => false,
}: {
  playgroundStore: PlaygroundStore;
  setPendingPromptToolWrite: (
    toolCallId: string,
    write: PendingPromptToolWrite | null
  ) => void;
  shouldAutoAccept?: () => boolean;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const writeContext = parsePromptToolsActionContext(context);
    if (!writeContext) {
      return {
        ok: false,
        error: "Cannot propose prompt tool changes without tool call context.",
      };
    }
    const parsed = parseWritePromptToolsInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid write_prompt_tools input." };
    }
    const plan = planWritePromptTools({ playgroundStore, input: parsed });
    if (!plan.ok) return plan;

    const { instanceId, index, provider, beforeTools, afterTools } =
      plan.output;
    const before = buildPromptToolsDisplaySnapshot({
      instanceId,
      index,
      tools: beforeTools,
      provider,
    });
    const after = buildPromptToolsDisplaySnapshot({
      instanceId,
      index,
      tools: afterTools,
      provider,
    });
    const summary = computePromptToolsWriteSummary(plan.output);

    const pendingWrite = bindPendingPromptToolWriteActions({
      pendingWrite: {
        toolCallId: writeContext.toolCallId,
        sessionId: writeContext.sessionId,
        instanceId,
        expectedRevision: parsed.expectedRevision,
        provider,
        input: parsed,
        before,
        after,
        summary,
      },
      playgroundStore,
      addToolOutput: writeContext.addToolOutput,
      setPendingPromptToolWrite,
    });

    if (shouldAutoAccept()) {
      await pendingWrite.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingPromptToolWrite(writeContext.toolCallId, pendingWrite);
    return { ok: true };
  };
}
