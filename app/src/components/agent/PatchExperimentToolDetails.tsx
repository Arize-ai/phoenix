import { css } from "@emotion/react";

import type {
  PatchExperimentFieldDiff,
  PendingPatchExperiment,
} from "@phoenix/agent/tools/patchExperiment";
import { Flex, Text } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

const FIELD_LABELS: Record<PatchExperimentFieldDiff["field"], string> = {
  name: "Name",
  description: "Description",
  metadata: "Metadata",
};

export function getPatchExperimentToolPreview(
  part: ToolInvocationPart
): string {
  const name = getExperimentName(part.output);
  if (name) return `Edit experiment "${name}"`;
  return "Propose experiment edit";
}

export function getPatchExperimentStatusVariant(
  part: ToolInvocationPart
): "danger" | "warning" | "success" | undefined {
  if (part.state === "output-error") return "danger";
  if (part.state === "output-available") {
    return getOutputStatus(part.output) === "rejected" ? "warning" : "success";
  }
  return undefined;
}

export function formatPatchExperimentState(part: ToolInvocationPart): string {
  switch (part.state) {
    case "input-available":
      return "Awaiting approval";
    case "output-available": {
      const status = getOutputStatus(part.output);
      if (status === "rejected") return "Rejected";
      if (status === "no_change") return "No change";
      return isAutoAccepted(part.output) ? "Auto-applied" : "Applied";
    }
    default:
      return formatToolState(part.state);
  }
}

export function PatchExperimentToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pendingPatch = useAgentContext(
    (state) =>
      state.pendingPatchExperimentsByToolCallId[part.toolCallId] ?? null
  );

  return (
    <div className="tool-part__body">
      {pendingPatch ? (
        <PendingPatchExperimentDetails pendingPatch={pendingPatch} />
      ) : null}
      {!pendingPatch && part.state === "output-available" ? (
        <ToolPartCodeBlock>{stringifyToolValue(part.output)}</ToolPartCodeBlock>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {!pendingPatch && part.state === "input-available" ? (
        <>
          <ToolPartLabel>Experiment edit</ToolPartLabel>
          <ToolPartCodeBlock>Preparing experiment edit...</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function PendingPatchExperimentDetails({
  pendingPatch,
}: {
  pendingPatch: PendingPatchExperiment;
}) {
  const canRespond = Boolean(pendingPatch.accept && pendingPatch.reject);
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel>
        Proposed edit to &ldquo;{pendingPatch.experimentName}&rdquo;
      </ToolPartLabel>
      <FieldDiffList diff={pendingPatch.diff} />
      <ToolPartApprovalActions
        onAccept={() => void pendingPatch.accept?.()}
        onReject={() => void pendingPatch.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This edit was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      />
    </Flex>
  );
}

const fieldDiffCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-125);
  padding: var(--global-dimension-size-50) var(--global-dimension-size-150)
    var(--global-dimension-size-125);
`;

const fieldDiffRowCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-50);
  min-width: 0;
`;

function FieldDiffList({ diff }: { diff: PatchExperimentFieldDiff[] }) {
  return (
    <div css={fieldDiffCSS}>
      {diff.map((change) => (
        <div key={change.field} css={fieldDiffRowCSS}>
          <Text size="XS" color="text-700" weight="heavy">
            {FIELD_LABELS[change.field]}
          </Text>
          <FieldDiffValue label="Before" value={change.previous} />
          <FieldDiffValue label="After" value={change.next} />
        </div>
      ))}
    </div>
  );
}

function FieldDiffValue({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <Flex direction="row" gap="size-100" alignItems="start" minWidth="0">
      <Text size="XS" color="text-500">
        {label}
      </Text>
      {value === null ? (
        <Text size="XS" color="text-500" fontStyle="italic">
          (none)
        </Text>
      ) : (
        <Text size="XS" color="text-900">
          {value}
        </Text>
      )}
    </Flex>
  );
}

function getOutputStatus(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { status?: unknown };
  return typeof candidate.status === "string" ? candidate.status : null;
}

function getExperimentName(output: unknown): string | null {
  if (typeof output !== "object" || output === null) return null;
  const candidate = output as { experimentName?: unknown };
  return typeof candidate.experimentName === "string"
    ? candidate.experimentName
    : null;
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
