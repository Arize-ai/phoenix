import { css } from "@emotion/react";

import { Text } from "@phoenix/components";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import type { AnnotationSummary } from "@phoenix/components/annotation/types";
import { RowPreviewCard } from "@phoenix/components/trace/RowPreviewCard";
import { SpanPreviewAnnotations } from "@phoenix/components/trace/SpanPreviewAnnotations";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import type { TokenDetailsBreakdownProps } from "@phoenix/components/trace/TokenDetailsBreakdown";
import type { SpanStatusCodeType } from "@phoenix/components/trace/types";

/**
 * Rows shown of each eval group. The preview closes when the pointer leaves
 * the row, so it can't scroll; this is what fits a 620px tall viewport with
 * both groups over the cap and a two-row breakdown.
 */
const MAX_EVAL_ROWS_PER_GROUP = 2;

const cardCSS = css`
  /* The name wraps, so the index sits on its first line */
  .session-turn-preview__index {
    flex: none;
    align-self: flex-start;
  }
  /* The turn list truncates names, so the preview is where they're readable */
  .session-turn-preview__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .session-turn-preview__status {
    display: flex;
    flex: none;
  }
  .session-turn-preview__evals {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-150);
  }
`;

/**
 * What the preview shows of a turn: everything but the token and cost split
 * comes with the turn list, so the preview opens on it at once.
 */
export type SessionTurnPreviewTurn = {
  traceId: string;
  /** The trace's node id, to load the turn's token and cost split. */
  traceNodeId: string;
  /** The turn's position in the session, as the list labels it: "01". */
  indexLabel: string;
  name: string;
  /** The root span's own status. */
  statusCode: SpanStatusCodeType;
  startTime: string;
  endTime: string | null;
  latencyMs: number | null;
  /** The token total the turn row shows. */
  tokenCountTotal: number | null;
  /** The cost total the turn row shows. */
  costTotal: number | null;
  traceAnnotationSummaries: readonly AnnotationSummary[] | null | undefined;
  rootSpanAnnotationSummaries: readonly AnnotationSummary[] | null | undefined;
};

export type SessionTurnPreviewCardProps = {
  turn: SessionTurnPreviewTurn;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /** Omit while loading; a skeleton then surrounds the turn's known totals. */
  metricsDetails?: TokenDetailsBreakdownProps | null;
};

/**
 * The content of a session turn's preview, laid out like the trace tree's
 * `SpanPreviewCard`: name and status, timing, the trace's and the root span's
 * evals, then the token and cost breakdown. `SessionTurnPreviewTooltip` loads
 * its breakdown.
 */
export function SessionTurnPreviewCard({
  turn,
  annotationConfigsByName,
  metricsDetails,
}: SessionTurnPreviewCardProps) {
  const hasEvals =
    !!turn.traceAnnotationSummaries?.length ||
    !!turn.rootSpanAnnotationSummaries?.length;
  return (
    <RowPreviewCard
      className="session-turn-preview"
      css={cardCSS}
      header={
        <>
          <Text
            fontFamily="mono"
            color="text-500"
            className="session-turn-preview__index"
          >
            {turn.indexLabel}
          </Text>
          <Text weight="heavy" className="session-turn-preview__name">
            {turn.name}
          </Text>
          {turn.statusCode === "ERROR" ? (
            <span className="session-turn-preview__status">
              <SpanStatusCodeIcon statusCode="ERROR" />
            </span>
          ) : null}
        </>
      }
      timing={{
        startTime: turn.startTime,
        endTime: turn.endTime,
        latencyMs: turn.latencyMs,
      }}
      metricsDetails={metricsDetails}
      totals={{ tokens: turn.tokenCountTotal, cost: turn.costTotal }}
      // Most turns split into input and output only, so the preview holds still on load
      skeletonRows={2}
    >
      {hasEvals ? (
        // One section, so no divider runs between the two groups
        <div className="session-turn-preview__evals">
          <SpanPreviewAnnotations
            title="Trace"
            summaries={turn.traceAnnotationSummaries}
            annotationConfigsByName={annotationConfigsByName}
            maxRows={MAX_EVAL_ROWS_PER_GROUP}
            showUnfavorableCount={false}
          />
          <SpanPreviewAnnotations
            title="Root span"
            summaries={turn.rootSpanAnnotationSummaries}
            annotationConfigsByName={annotationConfigsByName}
            maxRows={MAX_EVAL_ROWS_PER_GROUP}
            showUnfavorableCount={false}
          />
        </div>
      ) : null}
    </RowPreviewCard>
  );
}
