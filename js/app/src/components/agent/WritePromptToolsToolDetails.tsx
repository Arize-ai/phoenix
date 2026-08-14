import {
  formatPromptToolsSummaryText,
  parseWritePromptToolsInput,
  type PendingPromptToolWrite,
  type PromptToolsDisplaySnapshot,
  promptToolsSnapshotToText,
  WRITE_PROMPT_TOOLS_TOOL_NAME,
} from "@phoenix/agent/tools/playgroundPromptTools";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { LazyDiffAcceptRejectToolDetails } from "./LazyDiffAcceptRejectToolDetails";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState } from "./toolPartTypes";

/** One-line collapsed preview of the proposed batch (counts of writes/deletes). */
export function getWritePromptToolsToolPreview(
  part: ToolInvocationPart
): string {
  const input = parseWritePromptToolsInput(part.input);
  if (!input) return "";
  const writes = input.tools?.length ?? 0;
  const deletes = input.deleteToolIds?.length ?? 0;
  const total = writes + deletes;
  if (total === 0) return "";
  return `${total} proposed tool change${total === 1 ? "" : "s"}`;
}

export function formatWritePromptToolsState(part: ToolInvocationPart): string {
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

export function WritePromptToolsToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pending = useAgentContext(
    (state) =>
      state.pendingPromptToolWritesByToolCallId[part.toolCallId] ?? null
  );
  const input = parseWritePromptToolsInput(part.input);

  return (
    <LazyDiffAcceptRejectToolDetails<
      PromptToolsDisplaySnapshot,
      PendingPromptToolWrite
    >
      part={part}
      pending={pending}
      snapshotToText={promptToolsSnapshotToText}
      fileName={
        pending
          ? `playground-instance-${pending.instanceId}-tools.json`
          : "playground-instance-tools.json"
      }
      renderHeader={renderToolsDiffHeader}
      preparingLabel={WRITE_PROMPT_TOOLS_TOOL_NAME}
      preparingText="Preparing tool changes diff..."
      staleSessionMessage="These tool changes were proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose them again."
      showPreparing={input != null && part.state === "input-available"}
    />
  );
}

function renderToolsDiffHeader(pending: PendingPromptToolWrite) {
  return (
    <>
      <div className="diff-accept-reject__header-icon">
        <AlphabeticIndexIcon index={pending.before.index} size="XS" />
      </div>
      <span className="diff-accept-reject__header-label">
        {pending.before.label}: {formatPromptToolsSummaryText(pending.summary)}
      </span>
    </>
  );
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
