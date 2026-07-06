import {
  type CodeEvaluatorDraftSnapshot,
  EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME,
  parseEditCodeEvaluatorDraftInput,
  type PendingCodeEvaluatorEdit,
} from "@phoenix/agent/tools/codeEvaluatorDraft";

import { LazyDiffAcceptRejectToolDetails } from "./LazyDiffAcceptRejectToolDetails";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState } from "./toolPartTypes";
import { usePendingApproval } from "./usePendingApproval";

export function getEditCodeEvaluatorDraftToolPreview(
  part: ToolInvocationPart
): string {
  const input = parseEditCodeEvaluatorDraftInput(part.input);
  if (!input) return "";
  return `${input.operations.length} proposed edit${input.operations.length === 1 ? "" : "s"}`;
}

export function formatEditCodeEvaluatorDraftState(
  part: ToolInvocationPart
): string {
  switch (part.state) {
    case "input-available":
      return "Awaiting approval";
    case "output-available": {
      const status = getOutputStatus(part.output);
      if (status === "rejected") return "Rejected";
      return isAutoAccepted(part.output) ? "Auto-approved" : "Accepted";
    }
    default:
      return formatToolState(part.state);
  }
}

export function EditCodeEvaluatorDraftToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pending = usePendingApproval(
    part.toolCallId,
    EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME
  );

  return (
    <LazyDiffAcceptRejectToolDetails<
      CodeEvaluatorDraftSnapshot,
      PendingCodeEvaluatorEdit
    >
      part={part}
      pending={pending}
      snapshotToText={draftSnapshotToText}
      fileName={
        pending ? draftFileName(pending.before) : "code-evaluator-draft.txt"
      }
      renderHeader={renderCodeEvaluatorDiffHeader}
      preparingLabel={EDIT_CODE_EVALUATOR_DRAFT_TOOL_NAME}
      preparingText="Preparing code-evaluator draft diff..."
      staleSessionMessage="This proposal was made in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      showPreparing={part.state === "input-available"}
    />
  );
}

function renderCodeEvaluatorDiffHeader(pending: PendingCodeEvaluatorEdit) {
  return (
    <span className="diff-accept-reject__header-label">
      Proposed diff for code-evaluator draft ({pending.before.mode} mode)
    </span>
  );
}

function draftFileName(snapshot: CodeEvaluatorDraftSnapshot): string {
  return snapshot.mode === "edit"
    ? `code-evaluator-${snapshot.evaluatorNodeId ?? "draft"}.txt`
    : "code-evaluator-draft.txt";
}

function draftSnapshotToText(snapshot: CodeEvaluatorDraftSnapshot): string {
  return [
    `name: ${snapshot.name}`,
    `description: ${snapshot.description}`,
    `language: ${snapshot.language}`,
    `sandboxConfigId: ${snapshot.sandboxConfigId ?? "null"}`,
    `inputMapping: ${JSON.stringify(snapshot.inputMapping, null, 2)}`,
    `testPayload: ${JSON.stringify(snapshot.testPayload, null, 2)}`,
    `outputConfigs: ${JSON.stringify(snapshot.outputConfigs, null, 2)}`,
    `sourceCode:\n${snapshot.sourceCode}`,
  ].join("\n\n");
}

function getOutputStatus(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { status?: unknown };
  return typeof candidate.status === "string" ? candidate.status : null;
}

function getAcceptedBy(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { acceptedBy?: unknown };
  return typeof candidate.acceptedBy === "string" ? candidate.acceptedBy : null;
}

function isAutoAccepted(output: unknown): boolean {
  const acceptedBy = getAcceptedBy(output);
  return acceptedBy === "auto" || acceptedBy === "system";
}
