import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type { PlaygroundStore } from "@phoenix/store/playground";

import {
  parseAddPromptInstanceInput,
  parseClonePromptInstanceInput,
  parseEditPromptActionContext,
  parseEditPromptInput,
  parseReadPromptInput,
  parseRemovePromptInstanceInput,
} from "./parsers";
import { bindPendingPromptEditActions } from "./pendingPromptEdit";
import { bindPendingPromptInstanceRemovalActions } from "./pendingPromptInstanceRemoval";
import {
  addPromptInstance,
  buildProposedPromptSnapshot,
  clonePromptInstance,
  getPromptSnapshot,
  resolveRemovablePromptInstance,
} from "./promptStore";
import type { PendingPromptEdit, PendingPromptInstanceRemoval } from "./types";

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
 * Creates the client action handler for the add_prompt_instance tool.
 * Adds a default-content comparison instance that inherits runnable playground
 * config.
 */
export function createAddPromptInstanceClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseAddPromptInstanceInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid add_prompt_instance input." };
    }
    const result = addPromptInstance({ playgroundStore });
    if (!result.ok) return result;
    return {
      ok: true,
      output: JSON.stringify(result.output, null, 2),
    };
  };
}

/**
 * Creates the client action handler for the remove_prompt_instance tool.
 * Manual edit mode queues an approval; bypass mode removes immediately.
 */
export function createRemovePromptInstanceClientAction({
  playgroundStore,
  setPendingPromptInstanceRemoval,
  shouldAutoAccept = () => false,
}: {
  playgroundStore: PlaygroundStore;
  setPendingPromptInstanceRemoval: (
    toolCallId: string,
    removal: PendingPromptInstanceRemoval | null
  ) => void;
  shouldAutoAccept?: () => boolean;
}) {
  return async (
    input: unknown,
    context?: unknown
  ): Promise<AgentClientActionResult> => {
    const actionContext = parseEditPromptActionContext(context);
    if (!actionContext) {
      return {
        ok: false,
        error: "Cannot remove prompt instance without tool call context.",
      };
    }
    const parsed = parseRemovePromptInstanceInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid remove_prompt_instance input." };
    }

    const preview = resolveRemovablePromptInstance({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!preview.ok) return preview;

    const pendingRemoval = bindPendingPromptInstanceRemovalActions({
      pendingRemoval: {
        toolCallId: actionContext.toolCallId,
        sessionId: actionContext.sessionId,
        instanceId: preview.output.instanceId,
        label: preview.output.label,
      },
      playgroundStore,
      addToolOutput: actionContext.addToolOutput,
      setPendingPromptInstanceRemoval,
    });

    if (shouldAutoAccept()) {
      await pendingRemoval.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingPromptInstanceRemoval(actionContext.toolCallId, pendingRemoval);
    return { ok: true };
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
  shouldAutoAccept = () => false,
}: {
  playgroundStore: PlaygroundStore;
  setPendingPromptEdit: (
    toolCallId: string,
    edit: PendingPromptEdit | null
  ) => void;
  shouldAutoAccept?: () => boolean;
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
        error: "The prompt has changed since it was last viewed by PXI.",
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

    if (shouldAutoAccept()) {
      await pendingEdit.accept?.({ approvalSource: "auto" });
      return { ok: true };
    }

    setPendingPromptEdit(editContext.toolCallId, pendingEdit);
    return { ok: true };
  };
}
