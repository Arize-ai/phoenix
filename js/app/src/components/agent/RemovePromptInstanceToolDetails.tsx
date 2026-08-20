import {
  parseRemovePromptInstanceInput,
  parseRemovePromptInstanceOutput,
  type PendingPromptInstanceRemoval,
} from "@phoenix/agent/tools/playgroundPrompt";
import { Flex } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

export function getRemovePromptInstanceToolPreview(
  part: ToolInvocationPart
): string {
  const result = parseRemovePromptInstanceOutput(part.output);
  if (result?.label) {
    return result.status === "rejected"
      ? `Removal rejected for ${result.label}`
      : `Removed ${result.label}`;
  }
  const input = parseRemovePromptInstanceInput(part.input);
  if (!input) return "";
  return `Remove instance ${input.instanceId}`;
}

export function getRemovePromptInstanceStatusVariant(
  part: ToolInvocationPart
): "danger" | "warning" | "success" | undefined {
  if (part.state === "output-error") return "danger";
  if (part.state === "output-available") {
    return parseRemovePromptInstanceOutput(part.output)?.status === "rejected"
      ? "warning"
      : "success";
  }
  return undefined;
}

export function formatRemovePromptInstanceState(
  part: ToolInvocationPart
): string {
  switch (part.state) {
    case "input-available":
      return "Awaiting approval";
    case "output-available": {
      const result = parseRemovePromptInstanceOutput(part.output);
      if (result?.status === "rejected") return "Rejected";
      return result?.acceptedBy === "auto" ? "Auto-approved" : "Accepted";
    }
    default:
      return formatToolState(part.state);
  }
}

export function RemovePromptInstanceToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pendingRemoval = useAgentContext(
    (state) =>
      state.pendingPromptInstanceRemovalsByToolCallId[part.toolCallId] ?? null
  );
  const input = parseRemovePromptInstanceInput(part.input);
  const result = parseRemovePromptInstanceOutput(part.output);
  const isRejected =
    part.state === "output-available" && result?.status === "rejected";

  return (
    <div className="tool-part__body">
      {pendingRemoval ? (
        <PendingRemovePromptInstanceDetails pendingRemoval={pendingRemoval} />
      ) : null}
      {part.state === "output-available" && result && !isRejected ? (
        <RemovePromptInstanceResultDetails result={result} />
      ) : null}
      {isRejected ? (
        <ToolPartLabel variant="warning">Removal rejected</ToolPartLabel>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {!pendingRemoval && input && part.state === "input-available" ? (
        <>
          <ToolPartLabel>Remove prompt instance</ToolPartLabel>
          <ToolPartCodeBlock>
            Preparing prompt instance removal approval...
          </ToolPartCodeBlock>
        </>
      ) : null}
      {part.state === "output-available" && !result ? (
        <>
          <ToolPartLabel>Result</ToolPartLabel>
          <ToolPartCodeBlock>
            {stringifyToolValue(part.output)}
          </ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function PendingRemovePromptInstanceDetails({
  pendingRemoval,
}: {
  pendingRemoval: PendingPromptInstanceRemoval;
}) {
  const canRespond = Boolean(pendingRemoval.accept && pendingRemoval.reject);
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel>Allow removing prompt instance?</ToolPartLabel>
      <ToolPartCodeBlock>
        {`Prompt instance ${pendingRemoval.label} will be removed.`}
      </ToolPartCodeBlock>
      <ToolPartApprovalActions
        onAccept={() => void pendingRemoval.accept?.()}
        onReject={() => void pendingRemoval.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This prompt instance removal was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      />
    </Flex>
  );
}

function RemovePromptInstanceResultDetails({
  result,
}: {
  result: NonNullable<ReturnType<typeof parseRemovePromptInstanceOutput>>;
}) {
  return (
    <>
      <ToolPartLabel variant="success">
        {result.label
          ? `Removed prompt instance ${result.label}`
          : "Removed prompt instance"}
      </ToolPartLabel>
      {typeof result.instanceId === "number" && result.label ? (
        <ToolPartCodeBlock>
          {`Removed ${result.label} (${result.instanceId}).`}
        </ToolPartCodeBlock>
      ) : (
        <ToolPartCodeBlock>{stringifyToolValue(result)}</ToolPartCodeBlock>
      )}
    </>
  );
}
