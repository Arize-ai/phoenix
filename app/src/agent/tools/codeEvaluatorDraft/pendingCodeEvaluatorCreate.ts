import { CREATE_CODE_EVALUATOR_TOOL_NAME } from "@phoenix/agent/tools/createCodeEvaluator";

import { CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR } from "./constants";
import type {
  BindPendingCodeEvaluatorCreateOptions,
  PendingCodeEvaluatorCreate,
} from "./types";

const USER_REJECTED_MESSAGE =
  "User rejected the proposed code-evaluator creation.";
const SLIDEOVER_CANCELLED_MESSAGE =
  "User cancelled the code-evaluator create slideover without saving.";

/**
 * Bind the proposal lifecycle actions to a fresh pending create entry.
 *
 * The pending entry starts in `phase: "preview"`. The chat-side preview card
 * calls `accept` (flip to `"awaiting-slideover"`, no tool output) or `reject`
 * (terminal). The page-mounted slideover then drives a Save or Cancel terminal
 * resolver, guarded by the shared `resolved` latch so a successful Save cannot
 * be undone by the dialog's subsequent close handler firing `resolveAsRejected`.
 */
export function bindPendingCodeEvaluatorCreateActions({
  pendingCreate,
  addToolOutput,
  setPendingCodeEvaluatorCreate,
}: BindPendingCodeEvaluatorCreateOptions): PendingCodeEvaluatorCreate {
  // Mutable state shared across all bound callbacks: `phase` advances from
  // "preview" to "awaiting-slideover" on accept; `resolved` latches the
  // first terminal so subsequent terminals are no-ops.
  const state = {
    phase: "preview" as PendingCodeEvaluatorCreate["phase"],
    resolved: false,
  };

  const writeBack = () => {
    setPendingCodeEvaluatorCreate(pendingCreate.toolCallId, {
      ...bound,
      phase: state.phase,
      resolved: state.resolved,
    });
  };

  const clear = () => {
    setPendingCodeEvaluatorCreate(pendingCreate.toolCallId, null);
  };

  const accept = async () => {
    if (state.resolved || state.phase !== "preview") return;
    state.phase = "awaiting-slideover";
    writeBack();
  };

  const reject = async () => {
    if (state.resolved) return;
    state.resolved = true;
    clear();
    await addToolOutput({
      state: "output-available",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId: pendingCreate.toolCallId,
      output: JSON.stringify({
        status: "rejected",
        message: USER_REJECTED_MESSAGE,
      }),
    });
  };

  const resolveAsAccepted = async (result: {
    datasetEvaluatorId: string;
    createdEvaluator: { id: string; name: string };
  }) => {
    if (state.resolved) return;
    state.resolved = true;
    clear();
    await addToolOutput({
      state: "output-available",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId: pendingCreate.toolCallId,
      output: JSON.stringify({
        status: "accepted",
        datasetEvaluatorId: result.datasetEvaluatorId,
        createdEvaluator: result.createdEvaluator,
      }),
    });
  };

  const resolveAsRejected = async () => {
    if (state.resolved) return;
    state.resolved = true;
    clear();
    await addToolOutput({
      state: "output-available",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId: pendingCreate.toolCallId,
      output: JSON.stringify({
        status: "rejected",
        message: SLIDEOVER_CANCELLED_MESSAGE,
      }),
    });
  };

  const cancel = async () => {
    if (state.resolved) return;
    state.resolved = true;
    clear();
    await addToolOutput({
      state: "output-error",
      tool: CREATE_CODE_EVALUATOR_TOOL_NAME,
      toolCallId: pendingCreate.toolCallId,
      errorText: CREATE_CODE_EVALUATOR_NAVIGATION_CANCEL_ERROR,
    });
  };

  const bound: PendingCodeEvaluatorCreate = {
    ...pendingCreate,
    phase: state.phase,
    resolved: state.resolved,
    accept,
    reject,
    resolveAsAccepted,
    resolveAsRejected,
    cancel,
  };
  return bound;
}
