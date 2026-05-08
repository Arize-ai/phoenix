import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import {
  parseClonePromptInstanceInput,
  parseEditPromptActionContext,
  parseEditPromptInput,
  parseReadPromptInput,
} from "./parsers";
import { bindPendingPromptEditActions } from "./pendingPromptEdit";
import {
  buildProposedPromptSnapshot,
  clonePromptInstance,
  getPromptSnapshot,
} from "./promptStore";
import type { PendingPromptEdit } from "./types";

/**
 * Creates the client action handler for the read_prompt_instance tool.
 * Returns the current prompt snapshot as JSON.
 */
export function createReadPromptClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadPromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid read_prompt_instance input." };
    }
    const snapshot = getPromptSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!snapshot.ok) {
      return snapshot;
    }
    return { ok: true, output: JSON.stringify(snapshot.output, null, 2) };
  };
}

/**
 * Creates the client action handler for the clone_prompt_instance tool.
 * Duplicates an instance for side-by-side comparison.
 */
export function createClonePromptInstanceClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseClonePromptInstanceInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid clone_prompt_instance input." };
    }
    const result = clonePromptInstance({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!result.ok) return result;
    return {
      ok: true,
      output: JSON.stringify(result.output, null, 2),
    };
  };
}

/**
 * Creates the client action handler for the edit_prompt_instance tool. Validates
 * the edit against the current revision, builds a preview, and registers
 * a pending edit for user approval before committing changes.
 */
export function createEditPromptClientAction({
  playgroundStore,
  setPendingPromptEdit,
}: {
  playgroundStore: PlaygroundStore;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const editContext = parseEditPromptActionContext(context);
    if (!editContext) {
      return {
        ok: false,
        error: "Cannot propose prompt edit without tool call context.",
      };
    }
    const parsed = parseEditPromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid edit_prompt_instance input." };
    }
    const before = getPromptSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!before.ok) return before;
    if (before.output.revision !== parsed.expectedRevision) {
      return {
        ok: false,
        error:
          "The prompt changed since read_prompt_instance was called. Call read_prompt_instance again before proposing edits.",
      };
    }
    const proposed = buildProposedPromptSnapshot({
      snapshot: before.output,
      operations: parsed.operations,
    });
    if (!proposed.ok) return proposed;

    const pendingEdit = bindPendingPromptEditActions({
      pendingEdit: {
        toolCallId: editContext.toolCallId,
        sessionId: editContext.sessionId,
        instanceId: parsed.instanceId,
        expectedRevision: parsed.expectedRevision,
        before: before.output,
        after: proposed.output.after,
        operations: proposed.output.operations,
      },
      playgroundStore,
      addToolOutput: editContext.addToolOutput,
      setPendingPromptEdit,
    });
    setPendingPromptEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}
