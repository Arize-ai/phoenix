import type { AgentStore } from "@phoenix/store/agentStore";

import { bindPendingDatasetWrite } from "./bindPendingDatasetWrite";
import type {
  DatasetWriteApplyResult,
  DatasetWritePreview,
  DatasetWriteToolOutputSender,
} from "./types";

/**
 * Stage an approval-gated dataset write: bind the pending write, then either
 * apply immediately (bypass edit mode) or park it for the inline Accept/Reject
 * card (manual mode). Collapses the boilerplate every dataset-write tool repeats.
 */
export async function stageDatasetWrite({
  sessionId,
  pending: proposal,
  apply,
  addToolOutput,
  agentStore,
}: {
  sessionId: string | null;
  pending: {
    toolCallId: string;
    toolName: string;
    preview: DatasetWritePreview;
  };
  apply: () => Promise<DatasetWriteApplyResult>;
  addToolOutput: DatasetWriteToolOutputSender;
  agentStore: AgentStore;
}): Promise<void> {
  const pending = bindPendingDatasetWrite({
    pending: { ...proposal, sessionId },
    apply,
    addToolOutput,
    setPendingDatasetWrite: agentStore.getState().setPendingDatasetWrite,
  });
  if (agentStore.getState().permissions.edits === "bypass") {
    await pending.accept?.({ approvalSource: "auto" });
    return;
  }
  agentStore.getState().setPendingDatasetWrite(proposal.toolCallId, pending);
}
