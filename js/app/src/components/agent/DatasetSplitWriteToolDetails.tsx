import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { DatasetWriteApprovalCard } from "./DatasetWriteApprovalCard";
import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

/**
 * Shared details for the approval-gated dataset split/label write tools
 * (create_dataset_split, set_dataset_example_splits, create_dataset_label,
 * set_dataset_labels): renders the inline Accept/Reject card while pending,
 * then the result or error.
 */
export function DatasetSplitWriteToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pending = useAgentContext(
    (state) => state.pendingDatasetWritesByToolCallId[part.toolCallId] ?? null
  );
  return (
    <div className="tool-part__body">
      {pending ? <DatasetWriteApprovalCard pending={pending} /> : null}
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
