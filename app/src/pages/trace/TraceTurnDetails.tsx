import { css } from "@emotion/react";
import { Suspense } from "react";

import { Flex, Loading, View } from "@phoenix/components";
import { TraceDetailPanelAnnotationBar } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import type { TraceTurnContent_rootSpan$key } from "@phoenix/pages/trace/__generated__/TraceTurnContent_rootSpan.graphql";

import {
  TraceDetailsHeader,
  TraceDetailsHeaderSkeleton,
} from "./TraceDetailsHeader";
import { DetailPanelAnnotationBarSkeleton } from "./TraceDetailsSkeleton";
import { TraceTurnContent } from "./TraceTurnContent";

type TraceTurnRootSpan = TraceTurnContent_rootSpan$key & {
  readonly cumulativeTokenCountTotal: number | null;
  readonly latencyMs: number | null;
  readonly startTime: string;
  readonly trace: {
    readonly costSummary: {
      readonly total: {
        readonly cost: number | null;
      };
    };
  };
};

/** Shared trace-level header and turn content shown when a trace owns selection. */
export function TraceTurnDetails({
  rootSpan,
  traceId,
  traceNodeId,
}: {
  rootSpan: TraceTurnRootSpan;
  traceId: string;
  traceNodeId: string;
}) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      <TraceDetailsHeader
        annotationBar={
          <Suspense
            fallback={
              <DetailPanelAnnotationBarSkeleton variant="detail-header" />
            }
          >
            <TraceDetailPanelAnnotationBar traceNodeId={traceNodeId} />
          </Suspense>
        }
        trace={{
          id: traceNodeId,
          traceId,
          latencyMs: rootSpan.latencyMs,
          startTime: rootSpan.startTime,
          tokenCountTotal: rootSpan.cumulativeTokenCountTotal,
          totalCost: rootSpan.trace.costSummary.total.cost,
        }}
      />
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow: auto;
        `}
      >
        <View padding="var(--global-grid-margin-xsmall)">
          <TraceTurnContent rootSpan={rootSpan} />
        </View>
      </div>
    </div>
  );
}

export function TraceTurnDetailsSkeleton() {
  return (
    <Flex direction="column" height="100%" aria-busy="true">
      <TraceDetailsHeaderSkeleton
        annotationBar={
          <DetailPanelAnnotationBarSkeleton variant="detail-header" />
        }
      />
      <Flex flex="1 1 auto" minHeight={0}>
        <Loading />
      </Flex>
    </Flex>
  );
}
