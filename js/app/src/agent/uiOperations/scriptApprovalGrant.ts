/**
 * Script-level approval grants for `execute_browser_action` runs.
 *
 * The operation counterpart of the bash tool's GraphQL mutation policy: the
 * user approves (or bypasses) the *entire proposed script* before it runs,
 * and that single consent covers every state-changing `ui.*` call the script
 * makes. `execute_browser_action` grants the enclosing tool-call id before
 * spawning the worker — after the user accepts the script's
 * `write_description` in manual edit mode, or immediately in bypass edit
 * mode — and revokes it when the run settles.
 *
 * Dispatch and the per-operation staging helpers consult the grant through
 * the *inner operation call id* (`<hostToolCallId>:<sequence>`): dispatch to
 * refuse state-changing calls from unapproved scripts, staging helpers to
 * apply their writes immediately instead of staging a second, per-call
 * Accept/Reject card for a change the user already approved.
 */

const grantedHostToolCallIds = new Set<string>();

/** Record that the script run owned by `hostToolCallId` may change state. */
export function grantScriptApproval(hostToolCallId: string): void {
  grantedHostToolCallIds.add(hostToolCallId);
}

/** Remove the grant once the run settles (success, failure, or interrupt). */
export function revokeScriptApproval(hostToolCallId: string): void {
  grantedHostToolCallIds.delete(hostToolCallId);
}

/**
 * Whether the operation call identified by `operationCallId`
 * (`<hostToolCallId>:<sequence>`) belongs to an approved script run. Accepts
 * a bare host tool-call id too, for callers that hold no sequence suffix.
 */
export function isOperationCallApprovalGranted(
  operationCallId: string
): boolean {
  const separatorIndex = operationCallId.lastIndexOf(":");
  const hostToolCallId =
    separatorIndex === -1
      ? operationCallId
      : operationCallId.slice(0, separatorIndex);
  return grantedHostToolCallIds.has(hostToolCallId);
}
