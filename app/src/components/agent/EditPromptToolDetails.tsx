import {
  EDIT_PROMPT_TOOL_NAME,
  parseEditPromptInput,
  type PendingPromptEdit,
  type PromptSnapshot,
  promptSnapshotToText,
} from "@phoenix/agent/tools/playgroundPrompt";
import { AlphabeticIndexIcon } from "@phoenix/components/AlphabeticIndexIcon";

import { LazyDiffAcceptRejectToolDetails } from "./LazyDiffAcceptRejectToolDetails";
import { usePendingApproval } from "./usePendingApproval";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState } from "./toolPartTypes";

export function getEditPromptToolPreview(part: ToolInvocationPart): string {
  const input = parseEditPromptInput(part.input);
  if (!input) return "";
  return `${input.operations.length} proposed edit${input.operations.length === 1 ? "" : "s"}`;
}

export function formatEditPromptState(part: ToolInvocationPart): string {
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

export function EditPromptToolDetails({ part }: { part: ToolInvocationPart }) {
  const pending = usePendingApproval(part.toolCallId, EDIT_PROMPT_TOOL_NAME);
  const input = parseEditPromptInput(part.input);

  return (
    <LazyDiffAcceptRejectToolDetails<PromptSnapshot, PendingPromptEdit>
      part={part}
      pending={pending}
      snapshotToText={promptSnapshotToText}
      fileName={
        pending
          ? `playground-instance-${pending.instanceId}.txt`
          : "playground-instance.txt"
      }
      renderHeader={renderPromptDiffHeader}
      preparingLabel={EDIT_PROMPT_TOOL_NAME}
      preparingText="Preparing prompt edit diff..."
      staleSessionMessage="This edit was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      showPreparing={input != null && part.state === "input-available"}
    />
  );
}

function renderPromptDiffHeader(pending: PendingPromptEdit) {
  return (
    <>
      <div className="diff-accept-reject__header-icon">
        <AlphabeticIndexIcon index={pending.before.index} size="XS" />
      </div>
      <span className="diff-accept-reject__header-label">
        Proposed diff for {pending.before.label} (instance {pending.instanceId})
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
