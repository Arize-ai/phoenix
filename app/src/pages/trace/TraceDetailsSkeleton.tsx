import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import { CopyableIDBadge, Flex, Loading, Text } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { SpanKindBadge } from "@phoenix/components/trace/SpanKindBadge";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import { TRACE_TREE_ROW_SELECTION_BORDER_WIDTH } from "@phoenix/components/trace/traceTreeStyles";
import { TraceTreeToolbar } from "@phoenix/components/trace/TraceTreeToolbar";
import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
import { useTimeFormatters } from "@phoenix/hooks";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  DetailHeader,
  DetailHeaderIdentityRow,
  DetailHeaderMetaItem,
  DetailHeaderMetaRow,
  DetailHeaderTitle,
} from "../DetailHeader";
import { SpanStatusIndicator } from "../SpanHeader";
import { DetailsPanelContent } from "./DetailsPanel";
import { SessionDetailsHeader } from "./SessionDetailsHeader";
import { SpanDetailsHeaderActions } from "./SpanDetailsHeaderActions";
import { TraceDetailsHeaderSkeleton } from "./TraceDetailsHeader";

const traceTreeEntitySkeletonListCSS = css`
  flex: none;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const traceTreeEntitySkeletonCSS = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  width: 100%;
  min-height: var(--global-dimension-size-500);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  padding-left: var(
    --global-details-panel-navigation-row-content-padding-inline-start
  );
  border-left: ${TRACE_TREE_ROW_SELECTION_BORDER_WIDTH} solid transparent;

  .trace-tree-entity-skeleton__id {
    flex: none;
    margin-left: auto;
  }
`;

const spanHeaderNameSkeletonCSS = css`
  flex: 0 1 240px;
  min-width: var(--global-dimension-size-600);
`;

const annotationBarSkeletonCSS = css`
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-height: var(--global-dimension-size-600);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-top: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  &[data-variant="detail-header"] {
    min-height: var(--global-button-height-s);
    padding: 0;
    border: 0;
  }
`;

const spanDetailsLoadingNavigationCSS = css`
  display: flex;
  align-items: center;
  flex: none;
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  ul {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
  }

  li {
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }
`;

/** Loading state for a whole trace, including its tree and selected span. */
export function TraceDetailsSkeleton({
  isTreePanelCollapsed = false,
  onTreePanelCollapsedChange,
  treeHeader,
}: {
  isTreePanelCollapsed?: boolean;
  onTreePanelCollapsedChange?: (isCollapsed: boolean) => void;
  treeHeader?: ReactNode;
}) {
  return (
    <DetailsPanelContent
      navigation={
        <>
          {treeHeader}
          <TraceTreeNavigationSkeleton
            isTreePanelCollapsed={isTreePanelCollapsed}
            onTreePanelCollapsedChange={onTreePanelCollapsedChange}
          />
        </>
      }
    >
      <SkeletonDetailsWrapper>
        <SpanDetailsSkeleton />
      </SkeletonDetailsWrapper>
    </DetailsPanelContent>
  );
}

function SkeletonDetailsWrapper({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="trace-details-skeleton"
      css={css`
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      {children}
    </div>
  );
}

export function TraceTreeNavigationSkeleton({
  isTreePanelCollapsed,
  onTreePanelCollapsedChange,
}: {
  isTreePanelCollapsed: boolean;
  onTreePanelCollapsedChange?: (isCollapsed: boolean) => void;
}) {
  return (
    <TraceTreeProvider>
      <Flex direction="column" flex="1 1 auto" minHeight={0} aria-busy="true">
        <TraceTreeToolbar
          isTreePanelCollapsed={isTreePanelCollapsed}
          onTreePanelCollapsedChange={onTreePanelCollapsedChange}
        />
        <ul css={traceTreeEntitySkeletonListCSS}>
          <TraceTreeEntitySkeleton labelWidth={54} idWidth={104} />
          <TraceTreeEntitySkeleton labelWidth={42} idWidth={120} />
        </ul>
        <Flex flex="1 1 auto" minHeight={0} width="100%">
          <TraceTreeSkeleton />
        </Flex>
      </Flex>
    </TraceTreeProvider>
  );
}

function TraceTreeEntitySkeleton({
  idWidth,
  labelWidth,
}: {
  idWidth: number;
  labelWidth: number;
}) {
  return (
    <li css={traceTreeEntitySkeletonCSS}>
      <Skeleton width={20} height={20} animation="wave" />
      <Skeleton width={labelWidth} height={14} animation="wave" />
      <Skeleton
        className="trace-tree-entity-skeleton__id"
        width={idWidth}
        height={20}
        animation="wave"
      />
    </li>
  );
}

/** Loading state for the complete selected-span details column. */
export function SpanDetailsSkeleton({
  spanPreview,
  isCondensedView = true,
}: {
  spanPreview?: SpanDetailsPreview;
  isCondensedView?: boolean;
  showSessionHeader?: boolean;
  showTraceHeader?: boolean;
}) {
  return (
    <Flex direction="column" flex="1 1 auto" height="100%" aria-busy="true">
      <SpanHeaderSkeleton
        annotationBar={
          <DetailPanelAnnotationBarSkeleton variant="detail-header" />
        }
        spanPreview={spanPreview}
        isCondensedView={isCondensedView}
      />
      <SpanDetailsContentSkeleton />
    </Flex>
  );
}

export function SpanDetailsHeadersSkeleton({
  spanPreview,
  isCondensedView = true,
  showSessionHeader = true,
  showTraceHeader = true,
}: {
  spanPreview?: SpanDetailsPreview;
  isCondensedView?: boolean;
  showSessionHeader?: boolean;
  showTraceHeader?: boolean;
}) {
  const annotationBar = (
    <DetailPanelAnnotationBarSkeleton variant="detail-header" />
  );
  return (
    <>
      {showSessionHeader ? (
        <SessionDetailsHeader
          annotationBar={annotationBar}
          preview={{ sessionId: "" }}
        />
      ) : null}
      {showTraceHeader ? (
        <TraceDetailsHeaderSkeleton annotationBar={annotationBar} />
      ) : null}
      <SpanHeaderSkeleton
        annotationBar={annotationBar}
        spanPreview={spanPreview}
        isCondensedView={isCondensedView}
      />
    </>
  );
}

/** Keeps the two-row span identity header stable while its metadata loads. */
export function SpanHeaderSkeleton({
  annotationBar,
  spanPreview,
  isCondensedView = true,
}: {
  annotationBar?: ReactNode;
  spanPreview?: SpanDetailsPreview;
  isCondensedView?: boolean;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const hasLatencyPreview = spanPreview?.latencyMs !== undefined;
  const hasTokenCountPreview = spanPreview?.tokenCountTotal !== undefined;

  return (
    <DetailHeader annotationBar={annotationBar}>
      <Flex direction="column" gap="size-50" width="100%">
        <DetailHeaderIdentityRow>
          {spanPreview?.statusCode !== undefined ? (
            <SpanStatusIndicator statusCode={spanPreview.statusCode} />
          ) : (
            <Skeleton width={3} height={20} animation="wave" />
          )}
          {spanPreview ? (
            <DetailHeaderTitle title={spanPreview.name} />
          ) : (
            <Skeleton
              className="detail-header-skeleton__title span-header-skeleton__name"
              css={spanHeaderNameSkeletonCSS}
              height={22}
              animation="wave"
            />
          )}
          {spanPreview?.spanId !== undefined ? (
            <CopyableIDBadge
              id={spanPreview.spanId}
              showValue={false}
              tooltipText="Copy Span ID"
            />
          ) : (
            <Skeleton width={20} height={20} animation="wave" />
          )}
          <div className="detail-header__actions span-header__actions">
            <SpanDetailsHeaderActions
              buttonText={{
                addToDataset: isCondensedView ? null : "Add to Dataset",
                download: isCondensedView ? null : "Download",
                playground: isCondensedView ? null : "Playground",
              }}
              isDisabled={spanPreview == null}
              projectId={spanPreview?.projectId}
              spanId={spanPreview?.spanId}
              spanKind={spanPreview?.spanKind}
              spanNodeId={spanPreview?.id ?? ""}
              traceId={spanPreview?.traceId}
            />
          </div>
        </DetailHeaderIdentityRow>
        <DetailHeaderMetaRow
          trailing={
            annotationBar ? (
              <Skeleton width={220} height={32} animation="wave" />
            ) : undefined
          }
        >
          <DetailHeaderMetaItem>
            {spanPreview?.spanKind !== undefined ? (
              <SpanKindBadge spanKind={spanPreview.spanKind} />
            ) : (
              <Skeleton width={54} height={20} animation="wave" />
            )}
          </DetailHeaderMetaItem>
          {hasLatencyPreview ? (
            typeof spanPreview.latencyMs === "number" ? (
              <DetailHeaderMetaItem>
                <Text size="S" color="text-500" fontFamily="mono">
                  {latencyMsFormatter(spanPreview.latencyMs)}
                </Text>
              </DetailHeaderMetaItem>
            ) : null
          ) : (
            <DetailHeaderMetaItem>
              <Skeleton width={54} height={20} animation="wave" />
            </DetailHeaderMetaItem>
          )}
          <DetailHeaderMetaItem>
            {spanPreview?.startTime !== undefined ? (
              <Text size="S" color="text-500" fontFamily="mono">
                {fullTimeFormatter(new Date(spanPreview.startTime))}
              </Text>
            ) : (
              <Skeleton width={168} height={20} animation="wave" />
            )}
          </DetailHeaderMetaItem>
          {hasTokenCountPreview ? (
            spanPreview.tokenCountTotal ? (
              <DetailHeaderMetaItem>
                <SpanTokenCount
                  tokenCountTotal={spanPreview.tokenCountTotal}
                  nodeId={spanPreview.id}
                  size="S"
                  color="text-500"
                />
              </DetailHeaderMetaItem>
            ) : null
          ) : (
            <DetailHeaderMetaItem>
              <Skeleton width={64} height={20} animation="wave" />
            </DetailHeaderMetaItem>
          )}
        </DetailHeaderMetaRow>
      </Flex>
    </DetailHeader>
  );
}

/** Loading state for trace or span annotation rows. */
export function DetailPanelAnnotationBarSkeleton({
  variant = "default",
}: {
  variant?: "default" | "detail-header";
}) {
  return (
    <div css={annotationBarSkeletonCSS} aria-busy="true" data-variant={variant}>
      {variant === "default" ? (
        <Skeleton width={68} height={16} animation="wave" />
      ) : null}
      <Skeleton width={112} height={30} animation="wave" />
      <Skeleton width={92} height={30} animation="wave" />
      <Skeleton width={132} height={30} animation="wave" />
    </div>
  );
}

/** One spinner for the heavy body; section labels remain stable without counts. */
export function SpanDetailsContentSkeleton() {
  return (
    <Flex direction="column" flex="1 1 auto" minHeight={0} aria-busy="true">
      <nav
        css={spanDetailsLoadingNavigationCSS}
        aria-label="Loading span detail sections"
      >
        <ul>
          <li>
            <Text color="inherit" size="S">
              Info
            </Text>
          </li>
          <li>
            <Text color="inherit" size="S">
              Attributes
            </Text>
          </li>
          <li>
            <Text color="inherit" size="S">
              Events
            </Text>
          </li>
          <li>
            <Text color="inherit" size="S">
              Notes
            </Text>
          </li>
        </ul>
      </nav>
      <Flex flex="1 1 auto" minHeight={0}>
        <Loading />
      </Flex>
    </Flex>
  );
}
