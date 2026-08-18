import { parseAnnotateInput } from "@phoenix/agent/tools/annotate";
import type {
  AnnotateInput,
  PendingAnnotate,
} from "@phoenix/agent/tools/annotate";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

export function getAnnotateToolPreview(part: ToolInvocationPart): string {
  const annotation = parseAnnotateInput(part.input);
  if (!annotation) return "";
  return annotation.label
    ? `${annotation.name}: ${annotation.label}`
    : `Propose ${annotation.name} annotation`;
}

export function formatAnnotateState(part: ToolInvocationPart): string {
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

export function AnnotateToolDetails({ part }: { part: ToolInvocationPart }) {
  const pending = useAgentContext(
    (state) => state.pendingAnnotatesByToolCallId[part.toolCallId] ?? null
  );
  return (
    <div className="tool-part__body">
      {pending ? <PendingAnnotateDetails pending={pending} /> : null}
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

function PendingAnnotateDetails({ pending }: { pending: PendingAnnotate }) {
  const canRespond = Boolean(pending.accept && pending.reject);
  return (
    <>
      <ToolPartLabel>
        Proposed {pending.preview.target} annotation
      </ToolPartLabel>
      <ToolPartCodeBlock>
        {stringifyToolValue(describeAnnotation(pending.preview))}
      </ToolPartCodeBlock>
      <ToolPartApprovalActions
        onAccept={() => void pending.accept?.()}
        onReject={() => void pending.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This annotation was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      />
    </>
  );
}

function describeAnnotation(
  annotation: AnnotateInput
): Record<string, unknown> {
  const target =
    "spanId" in annotation
      ? { spanId: annotation.spanId }
      : "spanNodeId" in annotation
        ? { spanNodeId: annotation.spanNodeId }
        : "traceId" in annotation
          ? { traceId: annotation.traceId }
          : "traceNodeId" in annotation
            ? { traceNodeId: annotation.traceNodeId }
            : "sessionId" in annotation
              ? { sessionId: annotation.sessionId }
              : { sessionNodeId: annotation.sessionNodeId };
  return {
    target: annotation.target,
    ...target,
    name: annotation.name,
    annotatorKind: annotation.annotatorKind,
    ...(annotation.label != null ? { label: annotation.label } : {}),
    ...(annotation.score != null ? { score: annotation.score } : {}),
    ...(annotation.explanation != null
      ? { explanation: annotation.explanation }
      : {}),
    ...(annotation.identifier != null
      ? { identifier: annotation.identifier }
      : {}),
  };
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
