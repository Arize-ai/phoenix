/**
 * A proposed `execute_browser_action` script awaiting the user's
 * Accept/Reject in manual edit mode. Staged by the tool *before* the script
 * runs — the whole-script counterpart of the retired per-operation approval
 * cards, and the browser-side analogue of the bash tool's
 * `mutation_description` approval prompt.
 *
 * `description` is the model-authored `write_description`: the entire
 * approval prompt the user reads. `accept`/`reject` resolve the promise the
 * tool call is parked on; they are absent once the proposal can no longer be
 * acted on (e.g. after a refresh).
 */
export type PendingScriptApproval = {
  /** The `execute_browser_action` tool-call id that owns the script. */
  toolCallId: string;
  /** Model-authored, user-facing description of the changes the script makes. */
  description: string;
  accept?: () => Promise<void>;
  reject?: () => Promise<void>;
};
