import { isOperationCallApprovalGranted } from "@phoenix/agent/uiOperations/scriptApprovalGrant";
import { parseUIOperationCallContext } from "@phoenix/agent/uiOperations/types";
import type { AgentClientActionResult } from "@phoenix/store/agentStore";
import type {
  PlaygroundInstanceSource,
  PlaygroundStore,
} from "@phoenix/store/playground";

import { settleInstanceSource } from "../playgroundTask/instanceLoad";
import type { WaitForEvaluatorTaskHost } from "../playgroundTask/taskSnapshot";
import { readTaskSnapshot } from "../playgroundTask/taskSnapshot";
import {
  parseAddPromptInstanceInput,
  parseClonePromptInstanceInput,
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
 * Returns the current prompt snapshot as a structured object.
 */
export function createReadPromptClientAction({
  playgroundStore,
}: {
  playgroundStore: PlaygroundStore;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseReadPromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid playground.prompt.read input." };
    }
    const snapshot = getPromptSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!snapshot.ok) {
      return snapshot;
    }
    return snapshot;
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
      return { ok: false, error: "Invalid playground.instance.clone input." };
    }
    return clonePromptInstance({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
  };
}

function describeAddedInstance(source: PlaygroundInstanceSource): string {
  switch (source.type) {
    case "duplicate":
      return "Duplicate of the first task added for comparison.";
    case "new":
      return source.kind === "prompt"
        ? "Default prompt instance added for comparison."
        : `New ${source.kind} evaluator task added for comparison.`;
    default:
      return "Saved task loaded into a new instance for comparison.";
  }
}

/**
 * Creates the client action handler for `playground.instance.add`. Adds a
 * comparison instance from the given source (a new task of the page's kind
 * by default), awaits a saved source's content, and reports the new
 * instance in the shape of its kind's read operation.
 */
export function createAddPromptInstanceClientAction({
  playgroundStore,
  waitForEvaluatorHost,
}: {
  playgroundStore: PlaygroundStore;
  waitForEvaluatorHost: WaitForEvaluatorTaskHost;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    const parsed = parseAddPromptInstanceInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid playground.instance.add input." };
    }

    const added = addPromptInstance({ playgroundStore, source: parsed.source });

    if (!added.ok) return added;
    const { instanceId, source } = added.output;

    const failure = await settleInstanceSource({
      playgroundStore,
      instanceId,
      source,
    });

    if (failure) {
      // The UI leaves a blank draft behind too, with a toast; say so.
      return {
        ...failure,
        error: `${failure.error} Instance ${instanceId} was added as an empty draft: give it another task with playground.task.select, or remove it.`,
      };
    }

    const snapshot = await readTaskSnapshot({
      playgroundStore,
      instanceId,
      waitForEvaluatorHost,
    });

    if (!snapshot.ok) return snapshot;

    return {
      ok: true,
      output: {
        status: "added",
        addedInstance: snapshot.output,
        message: describeAddedInstance(source),
      },
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
    const callContext = parseUIOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error:
          "Cannot remove prompt instance without an operation call context.",
      };
    }
    const parsed = parseRemovePromptInstanceInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid playground.instance.remove input." };
    }

    const preview = resolveRemovablePromptInstance({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!preview.ok) return preview;

    // The returned promise resolves when the user (or bypass mode) decides;
    // the awaiting execute_browser_action script sits parked on it until then.
    return new Promise((resolve) => {
      const pendingRemoval = bindPendingPromptInstanceRemovalActions({
        pendingRemoval: {
          toolCallId: callContext.callId,
          sessionId: callContext.sessionId ?? "",
          instanceId: preview.output.instanceId,
          label: preview.output.label,
        },
        playgroundStore,
        emitResult: resolve,
        setPendingPromptInstanceRemoval,
      });

      if (
        shouldAutoAccept() ||
        isOperationCallApprovalGranted(callContext.callId)
      ) {
        void pendingRemoval.accept?.({ approvalSource: "auto" });
        return;
      }

      setPendingPromptInstanceRemoval(callContext.callId, pendingRemoval);
    });
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
    const callContext = parseUIOperationCallContext(context);
    if (!callContext) {
      return {
        ok: false,
        error: "Cannot propose prompt edit without an operation call context.",
      };
    }
    const parsed = parseEditPromptInput(input);
    if (!parsed) {
      return { ok: false, error: "Invalid playground.prompt.edit input." };
    }
    const before = getPromptSnapshot({
      playgroundStore,
      instanceId: parsed.instanceId,
    });
    if (!before.ok) return before;
    if (before.output.revision !== parsed.expectedRevision) {
      // A mismatch means the token is wrong, not necessarily that anyone
      // edited the prompt — say so, and carry the current revision so the
      // script can retry without another read.
      return {
        ok: false,
        code: "STALE_REVISION",
        error:
          `expectedRevision "${parsed.expectedRevision}" does not match the ` +
          `prompt's current revision "${before.output.revision}". Retry with ` +
          "the current revision (a successful edit's returned `revision` is " +
          "also valid); re-read the prompt only if you need its latest content.",
      };
    }
    const proposed = buildProposedPromptSnapshot({
      snapshot: before.output,
      operations: parsed.operations,
    });
    if (!proposed.ok) return proposed;

    // The returned promise resolves when the user (or bypass mode) decides;
    // the awaiting execute_browser_action script sits parked on it until then.
    return new Promise((resolve) => {
      const pendingEdit = bindPendingPromptEditActions({
        pendingEdit: {
          toolCallId: callContext.callId,
          sessionId: callContext.sessionId ?? "",
          instanceId: parsed.instanceId,
          expectedRevision: parsed.expectedRevision,
          before: before.output,
          after: proposed.output.after,
          operations: proposed.output.operations,
        },
        playgroundStore,
        emitResult: resolve,
        setPendingPromptEdit,
      });

      if (
        shouldAutoAccept() ||
        isOperationCallApprovalGranted(callContext.callId)
      ) {
        void pendingEdit.accept?.({ approvalSource: "auto" });
        return;
      }

      setPendingPromptEdit(callContext.callId, pendingEdit);
    });
  };
}
