import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { z } from "zod";

import {
  parseLoadDatasetInput,
  type DatasetSelectionSnapshot,
  type PendingLoadDataset,
} from "@phoenix/agent/tools/playgroundLoadDataset";
import { Flex } from "@phoenix/components";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

const loadDatasetToolDetailsCSS = css`
  && {
    padding-bottom: 0;
  }

  .load-dataset__preview {
    list-style: none;
    margin: 0;
    padding: var(--global-dimension-size-50) var(--global-dimension-size-250)
      var(--global-dimension-size-125);
    display: grid;
    gap: var(--global-dimension-size-75);
    font-family: var(--global-font-family-sans);
    white-space: normal;
  }

  .load-dataset__preview-row {
    display: grid;
    grid-template-columns: minmax(7rem, max-content) minmax(0, 1fr);
    gap: var(--global-dimension-size-150);
    align-items: baseline;
    min-width: 0;
  }

  .load-dataset__preview-label {
    color: var(--tool-call-secondary-color);
    text-transform: uppercase;
    font-size: var(--global-font-size-xs);
    letter-spacing: 0.05em;
    user-select: none;
  }

  .load-dataset__preview-value {
    min-width: 0;
    color: var(--global-text-color-900);
    overflow-wrap: anywhere;
  }
`;

export function getLoadDatasetToolPreview(part: ToolInvocationPart): string {
  const result = parseLoadDatasetResult(part.output);
  if (result?.datasetName) {
    return result.splitNames.length > 0
      ? `${result.datasetName} / ${result.splitNames.join(", ")}`
      : result.datasetName;
  }
  const input = parseLoadDatasetInput(part.input);
  if (!input) return "";
  return input.splitName
    ? `${input.datasetName} / ${input.splitName}`
    : input.datasetName;
}

export function getLoadDatasetStatusVariant(
  part: ToolInvocationPart
): "danger" | "warning" | "success" | undefined {
  if (part.state === "output-error") return "danger";
  if (part.state === "output-available") {
    return getOutputStatus(part.output) === "rejected" ? "warning" : "success";
  }
  return undefined;
}

export function formatLoadDatasetState(part: ToolInvocationPart): string {
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

export function LoadDatasetToolDetails({ part }: { part: ToolInvocationPart }) {
  const pendingLoad = useAgentContext(
    (state) => state.pendingLoadDatasetsByToolCallId[part.toolCallId] ?? null
  );
  const input = parseLoadDatasetInput(part.input);
  const isResolved = part.state === "output-available";
  const isRejected = isResolved && getOutputStatus(part.output) === "rejected";

  return (
    <div className="tool-part__body" css={loadDatasetToolDetailsCSS}>
      {pendingLoad ? (
        <PendingLoadDatasetDetails pendingLoad={pendingLoad} />
      ) : null}
      {isResolved && !isRejected ? (
        <LoadDatasetResultDetails output={part.output} />
      ) : null}
      {isRejected ? (
        <ToolPartLabel variant="warning">Load rejected</ToolPartLabel>
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {!pendingLoad && input && part.state === "input-available" ? (
        <>
          <ToolPartLabel>Load dataset</ToolPartLabel>
          <ToolPartCodeBlock>
            Preparing dataset load approval...
          </ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function LoadDatasetResultDetails({ output }: { output: unknown }) {
  const result = parseLoadDatasetResult(output);
  if (!result) {
    return (
      <>
        <ToolPartLabel>Result</ToolPartLabel>
        <ToolPartCodeBlock>{stringifyToolValue(output)}</ToolPartCodeBlock>
      </>
    );
  }

  return (
    <>
      <ToolPartLabel variant="success">
        Loaded a dataset into the playground
      </ToolPartLabel>
      <ul className="load-dataset__preview">
        <LoadDatasetPreviewRow label="Dataset">
          {result.datasetName ?? result.datasetId}
        </LoadDatasetPreviewRow>
        <LoadDatasetPreviewRow label="Split">
          {result.splitNames.length > 0
            ? result.splitNames.join(", ")
            : "All splits"}
        </LoadDatasetPreviewRow>
      </ul>
    </>
  );
}

function PendingLoadDatasetDetails({
  pendingLoad,
}: {
  pendingLoad: PendingLoadDataset;
}) {
  const canRespond = Boolean(pendingLoad.accept && pendingLoad.reject);
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel>Load dataset</ToolPartLabel>
      <LoadDatasetPreviewBlock snapshot={pendingLoad.snapshot} />
      <ToolPartApprovalActions
        onAccept={() => void pendingLoad.accept?.()}
        onReject={() => void pendingLoad.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This dataset load was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      />
    </Flex>
  );
}

function LoadDatasetPreviewBlock({
  snapshot,
}: {
  snapshot: DatasetSelectionSnapshot;
}) {
  const splitNames = snapshot.splitNames ?? [];
  return (
    <ul className="load-dataset__preview">
      <LoadDatasetPreviewRow label="From">Manual input</LoadDatasetPreviewRow>
      <LoadDatasetPreviewRow label="Dataset">
        {snapshot.datasetName ?? snapshot.datasetId}
      </LoadDatasetPreviewRow>
      {splitNames.length > 0 ? (
        <LoadDatasetPreviewRow label="Split">
          {splitNames.join(", ")}
        </LoadDatasetPreviewRow>
      ) : (
        <LoadDatasetPreviewRow label="Split">All splits</LoadDatasetPreviewRow>
      )}
    </ul>
  );
}

function LoadDatasetPreviewRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <li className="load-dataset__preview-row">
      <span className="load-dataset__preview-label">{label}</span>
      <div className="load-dataset__preview-value">{children}</div>
    </li>
  );
}

const loadDatasetResultSchema = z.object({
  status: z.literal("loaded"),
  datasetId: z.string(),
  datasetName: z.string().nullable(),
  splitNames: z.array(z.string()),
});

function parseLoadDatasetResult(output: unknown) {
  return loadDatasetResultSchema.safeParse(output).data ?? null;
}

const outputStatusSchema = z.object({ status: z.string() });
const autoAcceptedSchema = z.object({ acceptedBy: z.literal("auto") });

function getOutputStatus(output: unknown): string | null {
  return outputStatusSchema.safeParse(output).data?.status ?? null;
}

function isAutoAccepted(output: unknown): boolean {
  return autoAcceptedSchema.safeParse(output).success;
}
