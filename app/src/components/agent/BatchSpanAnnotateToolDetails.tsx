import { css } from "@emotion/react";
import { useState } from "react";

import {
  type AnnotateSpanInput,
  BATCH_SPAN_ANNOTATE_TOOL_NAME,
  parseBatchSpanAnnotateInput,
  type PendingBatchSpanAnnotate,
} from "@phoenix/agent/tools/batchSpanAnnotate";
import { Button, ExternalLink, Flex, Text } from "@phoenix/components";
import { baseAnnotationLabelCSS } from "@phoenix/components/annotation/AnnotationLabel";
import { AnnotationNameAndValue } from "@phoenix/components/annotation/AnnotationNameAndValue";
import { AnnotationTooltip } from "@phoenix/components/annotation/AnnotationTooltip";
import type { Annotation } from "@phoenix/components/annotation/types";
import { useAgentContext } from "@phoenix/contexts/AgentContext";

import {
  ToolPartApprovalActions,
  ToolPartCodeBlock,
  ToolPartLabel,
} from "./ToolPartPrimitives";
import type { ToolInvocationPart } from "./toolPartTypes";
import { formatToolState, stringifyToolValue } from "./toolPartTypes";

const MAX_VISIBLE_SPAN_ANNOTATIONS = 4;

export function getBatchSpanAnnotateToolPreview(
  part: ToolInvocationPart
): string {
  const annotations = parseBatchSpanAnnotateInput(part.input);
  if (!annotations || annotations.length === 0) return "";
  if (annotations.length === 1) {
    const [annotation] = annotations;
    return annotation.label
      ? `${annotation.name}: ${annotation.label}`
      : `Propose ${annotation.name} annotation`;
  }
  return `Propose ${annotations.length} annotations`;
}

export function formatBatchSpanAnnotateState(part: ToolInvocationPart): string {
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

export function BatchSpanAnnotateToolDetails({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const pendingAnnotation = useAgentContext(
    (state) =>
      state.pendingBatchSpanAnnotatesByToolCallId[part.toolCallId] ?? null
  );
  const annotations = parseBatchSpanAnnotateInput(part.input) ?? [];
  const hasAnnotations = annotations.length > 0;
  const isResolved = part.state === "output-available";
  const isRejected = isResolved && getOutputStatus(part.output) === "rejected";

  return (
    <div className="tool-part__body">
      {pendingAnnotation ? (
        <PendingBatchSpanAnnotateDetails
          pendingAnnotation={pendingAnnotation}
        />
      ) : null}
      {isResolved && !isRejected ? (
        hasAnnotations ? (
          <SpanAnnotationList annotations={annotations} />
        ) : (
          <ToolPartCodeBlock>
            {stringifyToolValue(part.output)}
          </ToolPartCodeBlock>
        )
      ) : null}
      {isRejected && hasAnnotations ? (
        <SpanAnnotationList annotations={annotations} />
      ) : null}
      {part.state === "output-error" ? (
        <>
          <ToolPartLabel variant="danger">Error</ToolPartLabel>
          <ToolPartCodeBlock>{part.errorText ?? ""}</ToolPartCodeBlock>
        </>
      ) : null}
      {!pendingAnnotation &&
      hasAnnotations &&
      part.state === "input-available" ? (
        <>
          <ToolPartLabel>{BATCH_SPAN_ANNOTATE_TOOL_NAME}</ToolPartLabel>
          <ToolPartCodeBlock>Preparing span annotations...</ToolPartCodeBlock>
        </>
      ) : null}
    </div>
  );
}

function PendingBatchSpanAnnotateDetails({
  pendingAnnotation,
}: {
  pendingAnnotation: PendingBatchSpanAnnotate;
}) {
  const canRespond = Boolean(
    pendingAnnotation.accept && pendingAnnotation.reject
  );
  const count = pendingAnnotation.annotations.length;
  return (
    <Flex direction="column" gap="size-100" minHeight="0">
      <ToolPartLabel>
        {count === 1
          ? "Proposed span annotation"
          : `Proposed span annotations (${count})`}
      </ToolPartLabel>
      <SpanAnnotationList annotations={pendingAnnotation.annotations} />
      <ToolPartApprovalActions
        onAccept={() => void pendingAnnotation.accept?.()}
        onReject={() => void pendingAnnotation.reject?.()}
        isDisabled={!canRespond}
        staleMessage="This annotation was proposed in an earlier session and can't be applied here. Re-run your request to have PXI propose it again."
      />
    </Flex>
  );
}

const spanAnnotationFieldsCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-125);
  /* Match the horizontal inset of other tool-part content rows. */
  padding: var(--global-dimension-size-50) var(--global-dimension-size-150)
    var(--global-dimension-size-125);
`;

/**
 * Full-width variant of the RunAnnotations chip. Reuses the shared annotation
 * label border and name/value rendering, but stretches across the tool part.
 * Truncation is disabled by passing `maxWidth="none"` to the name/value.
 */
const spanAnnotationChipCSS = css`
  ${baseAnnotationLabelCSS};
  /* The app defaults to content-box; without border-box the chip's border and
     padding would extend past its 100% width and overshoot the right inset. */
  box-sizing: border-box;
  width: fit-content;
`;

const spanAnnotationTargetCSS = css`
  display: flex;
  align-items: baseline;
  gap: var(--global-dimension-size-75);
  min-width: 0;
`;

const spanAnnotationTargetLinkCSS = css`
  min-width: 0;
  font-family: var(--global-font-family-mono);
  overflow-wrap: anywhere;
`;

// Inset a controls row (the accept/reject footer, the show-more toggle) to
// match the horizontal padding of the annotation content above it, with a
// little breathing room beneath.
const spanAnnotationControlsCSS = css`
  padding: 0 var(--global-dimension-size-150) var(--global-dimension-size-125);
`;

/** Renders one or more span annotations, one chip per annotation. */
function SpanAnnotationList({
  annotations,
}: {
  annotations: AnnotateSpanInput[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasHiddenAnnotations =
    annotations.length > MAX_VISIBLE_SPAN_ANNOTATIONS;
  const visibleAnnotations =
    isExpanded || !hasHiddenAnnotations
      ? annotations
      : annotations.slice(0, MAX_VISIBLE_SPAN_ANNOTATIONS);
  const hiddenAnnotationCount =
    annotations.length - MAX_VISIBLE_SPAN_ANNOTATIONS;

  return (
    <>
      {visibleAnnotations.map((annotation, index) => (
        <SpanAnnotationFields
          key={`${annotation.name}-${annotation.spanNodeId ?? annotation.spanId ?? index}`}
          annotation={annotation}
        />
      ))}
      {hasHiddenAnnotations ? (
        <div css={spanAnnotationControlsCSS}>
          <Button
            size="S"
            onPress={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Show fewer" : `Show ${hiddenAnnotationCount} more`}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Renders a span annotation as the same chip used in the RunAnnotations UI:
 * a color swatch derived from the annotation name, the name, and its
 * score/label, with a hover tooltip showing the full details. The chip spans
 * the full width of the tool part, and the explanation (if any) is rendered
 * beneath it. Shared by the pending proposal and resolved accept/reject states
 * so the displayed annotation stays consistent across the app.
 */
function SpanAnnotationFields({
  annotation,
}: {
  annotation: AnnotateSpanInput;
}) {
  const displayAnnotation: Annotation = {
    name: annotation.name,
    label: annotation.label,
    score: annotation.score,
    explanation: annotation.explanation,
  };
  const target = getSpanAnnotationTarget(annotation);

  return (
    <div css={spanAnnotationFieldsCSS}>
      <div css={spanAnnotationTargetCSS}>
        <Text size="XS" color="text-700" weight="heavy">
          Target
        </Text>
        {target.href ? (
          <span css={spanAnnotationTargetLinkCSS}>
            <ExternalLink href={target.href}>{target.text}</ExternalLink>
          </span>
        ) : (
          <Text size="XS" color="text-700" fontFamily="mono">
            {target.text}
          </Text>
        )}
      </div>
      <AnnotationTooltip annotation={displayAnnotation}>
        <div css={spanAnnotationChipCSS}>
          <AnnotationNameAndValue
            annotation={displayAnnotation}
            displayPreference="score-and-label"
            maxWidth="none"
          />
        </div>
      </AnnotationTooltip>
      {annotation.explanation ? (
        <Text size="XS" color="text-700">
          {annotation.explanation}
        </Text>
      ) : null}
    </div>
  );
}

function getSpanAnnotationTarget(annotation: AnnotateSpanInput): {
  href: string | null;
  text: string;
} {
  if (annotation.spanId) {
    return {
      href: `/redirects/spans/${encodeURIComponent(annotation.spanId)}`,
      text: `Span ${formatSpanTargetId(annotation.spanId)}`,
    };
  }
  if (annotation.spanNodeId) {
    return {
      href: null,
      text: `Span ${formatSpanTargetId(annotation.spanNodeId)}`,
    };
  }
  return { href: null, text: "Unknown span" };
}

function formatSpanTargetId(targetId: string): string {
  if (targetId.length <= 12) return targetId;
  return `${targetId.slice(0, 6)}...${targetId.slice(-4)}`;
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
