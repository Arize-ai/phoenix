import type { ReactNode } from "react";

import { CopyableIDBadge, Flex, Text } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { TraceTokenCosts } from "@phoenix/components/trace/TraceTokenCosts";
import { TraceTokenCount } from "@phoenix/components/trace/TraceTokenCount";
import { useTimeFormatters } from "@phoenix/hooks";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  DetailHeader,
  DetailHeaderIdentityRow,
  DetailHeaderMetaItem,
  DetailHeaderMetaRow,
  DetailHeaderTitle,
} from "../DetailHeader";

export type TraceDetailsHeaderData = {
  id: string;
  latencyMs: number | null;
  startTime: string;
  tokenCountTotal: number | null;
  totalCost: number | null;
  traceId: string;
};

/** Shared trace title, metadata, and annotation header. */
export function TraceDetailsHeader({
  annotationBar,
  metadataAction,
  trace,
}: {
  annotationBar?: ReactNode;
  metadataAction?: ReactNode;
  trace: TraceDetailsHeaderData;
}) {
  const { fullTimeFormatter } = useTimeFormatters();

  return (
    <DetailHeader annotationBar={annotationBar}>
      <Flex direction="column" gap="size-50" width="100%">
        <DetailHeaderIdentityRow>
          <DetailHeaderTitle title="Trace" />
          <CopyableIDBadge
            id={trace.traceId}
            showValue={false}
            tooltipText="Copy Trace ID"
          />
        </DetailHeaderIdentityRow>
        <DetailHeaderMetaRow trailing={metadataAction}>
          {typeof trace.latencyMs === "number" ? (
            <DetailHeaderMetaItem>
              <Text size="S" color="text-500" fontFamily="mono">
                {latencyMsFormatter(trace.latencyMs)}
              </Text>
            </DetailHeaderMetaItem>
          ) : null}
          <DetailHeaderMetaItem>
            <Text size="S" color="text-500" fontFamily="mono">
              {fullTimeFormatter(new Date(trace.startTime))}
            </Text>
          </DetailHeaderMetaItem>
          {trace.tokenCountTotal ? (
            <DetailHeaderMetaItem>
              <TraceTokenCount
                tokenCountTotal={trace.tokenCountTotal}
                nodeId={trace.id}
                size="S"
              />
            </DetailHeaderMetaItem>
          ) : null}
          {trace.totalCost ? (
            <DetailHeaderMetaItem>
              <TraceTokenCosts
                totalCost={trace.totalCost}
                nodeId={trace.id}
                size="S"
              />
            </DetailHeaderMetaItem>
          ) : null}
        </DetailHeaderMetaRow>
      </Flex>
    </DetailHeader>
  );
}

export function TraceDetailsHeaderSkeleton({
  annotationBar,
}: {
  annotationBar?: ReactNode;
}) {
  return (
    <DetailHeader annotationBar={annotationBar}>
      <Flex direction="column" gap="size-50" width="100%">
        <DetailHeaderIdentityRow>
          <DetailHeaderTitle title="Trace" />
          <Skeleton width={20} height={20} animation="wave" />
        </DetailHeaderIdentityRow>
        <DetailHeaderMetaRow>
          <DetailHeaderMetaItem>
            <Skeleton width={54} height={20} animation="wave" />
          </DetailHeaderMetaItem>
          <DetailHeaderMetaItem>
            <Skeleton width={168} height={20} animation="wave" />
          </DetailHeaderMetaItem>
          <DetailHeaderMetaItem>
            <Skeleton width={64} height={20} animation="wave" />
          </DetailHeaderMetaItem>
        </DetailHeaderMetaRow>
      </Flex>
    </DetailHeader>
  );
}
