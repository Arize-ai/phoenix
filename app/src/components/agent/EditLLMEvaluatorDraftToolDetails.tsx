import {
  EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME,
  type LLMEvaluatorDraftSnapshot,
  parseEditLlmEvaluatorDraftInput,
  type PendingLlmEvaluatorEdit,
} from "@phoenix/agent/tools/llmEvaluatorDraft";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { DiffAcceptRejectToolDetails } from "./DiffAcceptRejectToolDetails";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState } from "./toolPartTypes";

export function getEditLlmEvaluatorDraftToolPreview(
  part: ToolInvocationPart
): string {
  const input = parseEditLlmEvaluatorDraftInput(part.input);
  if (!input) return "";
  return `${input.operations.length} proposed edit${input.operations.length === 1 ? "" : "s"}`;
}

export function formatEditLlmEvaluatorDraftState(
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

export function EditLLMEvaluatorDraftToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pending = useAgentContext((state) => {
    return state.pendingLlmEvaluatorEditsByToolCallId[part.toolCallId] ?? null;
  });

  return (
    <DiffAcceptRejectToolDetails<
      LLMEvaluatorDraftSnapshot,
      PendingLlmEvaluatorEdit
    >
      part={part}
      pending={pending}
      snapshotToText={draftSnapshotToText}
      fileName={
        pending ? draftFileName(pending.before) : "llm-evaluator-draft.txt"
      }
      renderHeader={renderLlmEvaluatorDiffHeader}
      preparingLabel={EDIT_LLM_EVALUATOR_DRAFT_TOOL_NAME}
      preparingText="Preparing LLM-evaluator draft diff..."
      staleSessionMessage="This proposal was made in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      showPreparing={part.state === "input-available"}
    />
  );
}

function renderLlmEvaluatorDiffHeader(pending: PendingLlmEvaluatorEdit) {
  return (
    <span className="diff-accept-reject__header-label">
      Proposed diff for LLM-evaluator draft ({pending.before.mode} mode)
    </span>
  );
}

function draftFileName(snapshot: LLMEvaluatorDraftSnapshot): string {
  return snapshot.mode === "edit"
    ? `llm-evaluator-${snapshot.evaluatorNodeId ?? "draft"}.txt`
    : "llm-evaluator-draft.txt";
}

function draftSnapshotToText(snapshot: LLMEvaluatorDraftSnapshot): string {
  return [
    `name: ${snapshot.name}`,
    `description: ${snapshot.description}`,
    `includeExplanation: ${snapshot.includeExplanation}`,
    `inputMapping: ${JSON.stringify(snapshot.inputMapping, null, 2)}`,
    `testPayload: ${JSON.stringify(snapshot.testPayload, null, 2)}`,
    `outputConfigs: ${JSON.stringify(snapshot.outputConfigs, null, 2)}`,
    `judge: ${JSON.stringify(snapshot.judge, null, 2)}`,
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
