import type { AgentClientActionResult } from "@phoenix/store/agentStore";

/**
 * Who resolved a pending tool approval. `"user"` means a person clicked the
 * inline Accept button; `"auto"` means it was approved by the current edit
 * permission mode.
 *
 * Shared by every approval-gated agent tool (e.g. prompt edits, prompt saves,
 * and span annotations) so no tool module has to depend on another for the type.
 */
export type ApprovalSource = "user" | "auto";

/**
 * Terminal outcome of persisting an evaluator through the dialog's validated
 * mutation path (the same path the manual Create/Update button drives). On
 * success it carries the persisted evaluator identity the manual flow produces;
 * on failure it carries an actionable message (validation, missing prerequisite,
 * or server/mutation error) so the agent never reports a false accept.
 *
 * Shared by the code and LLM evaluator draft hosts so neither tool module has to
 * depend on the other for the type.
 */
export type EvaluatorSubmitResult =
  | {
      ok: true;
      acceptedBy: ApprovalSource;
      evaluator: { id: string; name: string };
    }
  | { ok: false; error: string };

/**
 * Builds the `submit` capability shared by the code and LLM evaluator draft
 * hosts. `getHandleSubmit` returns the dialog's current validated submit (the
 * same function the manual Create/Update button drives) or `null` when the form
 * is unmounted; routing through an accessor lets the long-lived host
 * registration always invoke the latest `handleSubmit` without re-registering.
 *
 * On success it stamps `acceptedBy` with the caller's approval source so the
 * bypass path is marked `"auto"` exactly as the manual path is marked `"user"`.
 */
export function createEvaluatorHostSubmit({
  getHandleSubmit,
  unmountedError,
}: {
  getHandleSubmit: () => (() => Promise<EvaluatorSubmitResult>) | null;
  unmountedError: string;
}) {
  return async ({
    approvalSource,
  }: {
    approvalSource: ApprovalSource;
  }): Promise<EvaluatorSubmitResult> => {
    const handleSubmit = getHandleSubmit();
    if (!handleSubmit) {
      return { ok: false, error: unmountedError };
    }
    const result = await handleSubmit();
    if (!result.ok) {
      return result;
    }
    return { ...result, acceptedBy: approvalSource };
  };
}

/** A host exposing the evaluator `submit` capability the save tool drives. */
type EvaluatorSubmitHost = {
  submit: (options: {
    approvalSource: ApprovalSource;
  }) => Promise<EvaluatorSubmitResult>;
};

/**
 * Structured payload the terminal-save tool surfaces to the agent. `persisted`
 * is `true` only when the evaluator was actually committed (bypass path), and
 * `false` when the draft is left open for the user to confirm (manual path), so
 * the agent can never report a save that did not happen.
 */
export type EvaluatorSubmitToolOutput =
  | {
      status: "saved";
      persisted: true;
      acceptedBy: ApprovalSource;
      evaluator: { id: string; name: string };
    }
  | {
      status: "awaiting_user";
      persisted: false;
      requiresUserAction: true;
      message: string;
    };

const AWAITING_USER_MESSAGE =
  "The draft is open — review and click the dialog's Create/Update button to persist the evaluator.";

/**
 * Builds the terminal-save client action shared by the code and LLM evaluator
 * draft tools. Under the bypass gate (`shouldAutoAccept`) it drives the host's
 * validated `submit` — the same create/patch path the manual Create/Update
 * button runs — and reports the persisted identity stamped `acceptedBy: "auto"`,
 * or surfaces an actionable failure (validation, missing prerequisite, or
 * server/mutation error) as a tool error so a failed save is never reported as a
 * success. Under manual approval it persists nothing and reports a non-completion
 * payload that directs the user to the dialog's confirm button.
 */
export function createEvaluatorSubmitClientAction<
  THost extends EvaluatorSubmitHost,
>({
  getDraftHost,
  parseInput,
  invalidInputError,
  notMountedError,
  shouldAutoAccept = () => false,
}: {
  getDraftHost: () => THost | null;
  parseInput: (input: unknown) => unknown;
  invalidInputError: string;
  notMountedError: string;
  shouldAutoAccept?: () => boolean;
}) {
  return async (input: unknown): Promise<AgentClientActionResult> => {
    if (parseInput(input) == null) {
      return { ok: false, error: invalidInputError };
    }
    const host = getDraftHost();
    if (!host) {
      return { ok: false, error: notMountedError };
    }
    if (!shouldAutoAccept()) {
      const output: EvaluatorSubmitToolOutput = {
        status: "awaiting_user",
        persisted: false,
        requiresUserAction: true,
        message: AWAITING_USER_MESSAGE,
      };
      return { ok: true, output: JSON.stringify(output) };
    }
    const result = await host.submit({ approvalSource: "auto" });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    const output: EvaluatorSubmitToolOutput = {
      status: "saved",
      persisted: true,
      acceptedBy: result.acceptedBy,
      evaluator: result.evaluator,
    };
    return { ok: true, output: JSON.stringify(output) };
  };
}
