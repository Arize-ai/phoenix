/**
 * Who resolved a pending tool approval. `"user"` means a person clicked the
 * inline Accept button; `"auto"` means it was approved by the current edit
 * permission mode.
 *
 * Shared by every approval-gated agent tool (e.g. prompt edits, prompt saves,
 * and span annotations) so no tool module has to depend on another for the type.
 */
export type ApprovalSource = "user" | "auto";
