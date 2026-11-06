import { parseCreateDatasetInput } from "@phoenix/agent/tools/createDataset";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import { DatasetWriteApprovalCard } from "./DatasetWriteApprovalCard";
import { ToolPartCodeBlock, ToolPartLabel } from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { stringifyToolValue } from "./toolPartTypes";

export function getCreateDatasetToolPreview(part: ToolInvocationPart): string {
  const input = parseCreateDatasetInput(part.input);
  if (!input) return "";
  const count = input.examples?.length ?? 0;
  return count > 0
    ? `${input.name} (${count} example${count === 1 ? "" : "s"})`
    : input.name;
}

export function CreateDatasetToolDetails({
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
