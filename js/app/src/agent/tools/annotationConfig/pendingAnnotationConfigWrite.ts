import { stageApprovalOperation } from "@phoenix/agent/shared/pendingApproval";
import type {
  AgentClientActionResult,
  AgentStore,
} from "@phoenix/store/agentStore";

import { ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE } from "./constants";
import type {
  AnnotationConfigWriteApplyResult,
  AnnotationConfigWritePreview,
} from "./types";

/**
 * Stage an approval-gated annotation-config write on behalf of an
 * `ui.annotationConfig.*` operation call: the operation counterpart of
 * `stageDatasetWriteOperation`. Accept/reject resolve the returned promise the
 * calling `execute_browser_action` script awaits.
 */
export function stageAnnotationConfigWriteOperation({
  pending,
  apply,
  agentStore,
}: {
  pending: {
    /** Inner operation call id (`<executeBrowserActionToolCallId>:<sequence>`). */
    toolCallId: string;
    /** Operation name (e.g. `annotationConfig.create`), for attribution. */
    toolName: string;
    preview: AnnotationConfigWritePreview;
  };
  apply: () => Promise<AnnotationConfigWriteApplyResult>;
  agentStore: AgentStore;
}): Promise<AgentClientActionResult> {
  return stageApprovalOperation({
    pending,
    apply,
    setPending: agentStore.getState().setPendingAnnotationConfigWrite,
    shouldAutoAccept: () =>
      agentStore.getState().permissions.edits === "bypass",
    rejectedMessage: ANNOTATION_CONFIG_WRITE_REJECTED_MESSAGE,
  });
}
