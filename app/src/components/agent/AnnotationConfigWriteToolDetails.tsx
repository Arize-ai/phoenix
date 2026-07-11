import {
  parseCreateAnnotationConfigInput,
  parseUpdateAnnotationConfigInput,
} from "@phoenix/agent/tools/annotationConfig";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { AnnotationConfigWriteApprovalCard } from "./AnnotationConfigWriteApprovalCard";
import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

/** Collapsed-row preview for `create_annotation_config`: the config name. */
export function getCreateAnnotationConfigToolPreview(
  part: ToolInvocationPart
): string {
  return parseCreateAnnotationConfigInput(part.input)?.name ?? "";
}

/** Collapsed-row preview for `update_annotation_config`: the config name. */
export function getUpdateAnnotationConfigToolPreview(
  part: ToolInvocationPart
): string {
  return parseUpdateAnnotationConfigInput(part.input)?.name ?? "";
}

/**
 * Shared details for the approval-gated annotation-config write tools
 * (create_annotation_config, update_annotation_config): renders the inline
 * Accept/Reject card while pending, then the result or error.
 */
export function AnnotationConfigWriteToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pending = useAgentContext(
    (state) =>
      state.pendingAnnotationConfigWritesByToolCallId[part.toolCallId] ?? null
  );
  return (
    <div className="tool-part__body">
      {pending ? <AnnotationConfigWriteApprovalCard pending={pending} /> : null}
      {part.state === "output-available" ? (
        <>
          <ToolPartLabel>Result</ToolPartLabel>
          <ToolPartCodeBlock>
            {stringifyToolValue(part.output)}
          </ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}
