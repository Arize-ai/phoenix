import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import {
  CopyableIDBadge,
  Flex,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { SpanKindBadge } from "@phoenix/components/trace/SpanKindBadge";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { TraceTreePanelToggleButton } from "@phoenix/components/trace/TraceTreePanelToggleButton";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import {
  TRACE_TREE_ROW_BORDER_WIDTH,
  TRACE_TREE_ROW_INLINE_START,
} from "@phoenix/components/trace/traceTreeStyles";
import type { SpanDetailsPreview } from "@phoenix/components/trace/types";
import { TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS } from "@phoenix/constants";
import { useTimeFormatters } from "@phoenix/hooks";
import { latencyMsFormatter } from "@phoenix/utils/numberFormatUtils";

import {
  SpanHeaderIdentityRow,
  SpanHeaderMetaItem,
  SpanHeaderMetaRow,
  SpanHeaderName,
  SpanStatusIndicator,
} from "../SpanHeader";
import { DetailsPanel } from "./DetailsPanel";
import { SpanDetailsHeaderActions } from "./SpanDetailsHeaderActions";

const traceDetailsSkeletonCSS = css`
  flex: 1 1 auto;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const traceTreeToolbarSkeletonCSS = css`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  width: 100%;
  height: var(--global-dimension-size-600);
  padding: var(--global-dimension-size-100);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);

  .trace-tree-toolbar-skeleton__search {
    flex: 1 1 auto;
    min-width: 0;
  }

  @container trace-tree-panel (width < ${TRACE_TREE_TOOLBAR_STACK_WIDTH_PIXELS}px) {
    display: none;
  }
`;

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
  padding-left: ${TRACE_TREE_ROW_INLINE_START};
  border-left: ${TRACE_TREE_ROW_BORDER_WIDTH} solid transparent;

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
  onPreferredTreeWidthChange,
  preferredTreeWidth,
  isTreePanelCollapsed,
  onTreePanelCollapsedChange,
  treeAddonWidth,
  treeHeader,
  treeMaximumWidth,
}: {
  onPreferredTreeWidthChange: (width: number) => void;
  preferredTreeWidth: number;
  isTreePanelCollapsed: boolean;
  onTreePanelCollapsedChange: (isCollapsed: boolean) => void;
  treeAddonWidth: number;
  treeHeader?: ReactNode;
  treeMaximumWidth: number;
}) {
  return (
    <main css={traceDetailsSkeletonCSS} aria-busy="true">
      <DetailsPanel
        navigation={
          <>
            {treeHeader}
            <TraceTreeNavigationSkeleton
              isTreePanelCollapsed={isTreePanelCollapsed}
              onTreePanelCollapsedChange={onTreePanelCollapsedChange}
            />
          </>
        }
        preferredTreeWidth={preferredTreeWidth}
        onPreferredTreeWidthChange={onPreferredTreeWidthChange}
        treeAddonWidth={treeAddonWidth}
        treeMaximumWidth={treeMaximumWidth}
      >
        <SkeletonDetailsWrapper>
          <SpanDetailsSkeleton />
        </SkeletonDetailsWrapper>
      </DetailsPanel>
    </main>
  );
}

function SkeletonDetailsWrapper({ children }: PropsWithChildren) {
  return (
    <div
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

function TraceTreeNavigationSkeleton({
  isTreePanelCollapsed,
  onTreePanelCollapsedChange,
}: {
  isTreePanelCollapsed: boolean;
  onTreePanelCollapsedChange: (isCollapsed: boolean) => void;
}) {
  return (
    <Flex direction="column" flex="1 1 auto" minHeight={0} aria-busy="true">
      <div css={traceTreeToolbarSkeletonCSS}>
        <Skeleton
          className="trace-tree-toolbar-skeleton__search"
          height={32}
          animation="wave"
        />
        <Skeleton width={32} height={32} animation="wave" />
        <Skeleton width={32} height={32} animation="wave" />
        <TraceTreePanelToggleButton
          isCollapsed={isTreePanelCollapsed}
          onCollapsedChange={onTreePanelCollapsedChange}
        />
      </div>
      <ul css={traceTreeEntitySkeletonListCSS}>
        <TraceTreeEntitySkeleton labelWidth={54} idWidth={104} />
        <TraceTreeEntitySkeleton labelWidth={42} idWidth={120} />
      </ul>
      <Flex flex="1 1 auto" minHeight={0} width="100%">
        <TraceTreeSkeleton />
      </Flex>
    </Flex>
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
}) {
  return (
    <Flex direction="column" flex="1 1 auto" height="100%" aria-busy="true">
      <SpanHeaderSkeleton
        spanPreview={spanPreview}
        isCondensedView={isCondensedView}
      />
      <DetailPanelAnnotationBarSkeleton />
      <SpanDetailsContentSkeleton />
    </Flex>
  );
}

/** Keeps the two-row span identity header stable while its metadata loads. */
export function SpanHeaderSkeleton({
  spanPreview,
  isCondensedView = true,
}: {
  spanPreview?: SpanDetailsPreview;
  isCondensedView?: boolean;
}) {
  const { fullTimeFormatter } = useTimeFormatters();
  const hasLatencyPreview = spanPreview?.latencyMs !== undefined;
  const hasTokenCountPreview = spanPreview?.tokenCountTotal !== undefined;

  return (
    <View
      paddingTop="size-100"
      paddingBottom="size-100"
      paddingStart="size-150"
      paddingEnd="size-200"
      flex="none"
    >
      <Flex direction="column" gap="size-50" width="100%">
        <SpanHeaderIdentityRow>
          {spanPreview?.statusCode !== undefined ? (
            <SpanStatusIndicator statusCode={spanPreview.statusCode} />
          ) : (
            <Skeleton width={3} height={20} animation="wave" />
          )}
          {spanPreview ? (
            <SpanHeaderName name={spanPreview.name} />
          ) : (
            <Skeleton
              className="span-header-skeleton__name"
              css={spanHeaderNameSkeletonCSS}
              height={22}
              animation="wave"
            />
          )}
          <div className="span-header__actions">
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
        </SpanHeaderIdentityRow>
        <SpanHeaderMetaRow>
          <SpanHeaderMetaItem>
            {spanPreview?.spanKind !== undefined ? (
              <SpanKindBadge spanKind={spanPreview.spanKind} />
            ) : (
              <Skeleton width={54} height={20} animation="wave" />
            )}
          </SpanHeaderMetaItem>
          <SpanHeaderMetaItem>
            {spanPreview?.spanId !== undefined ? (
              <CopyableIDBadge
                id={spanPreview.spanId}
                tooltipText="Copy Span ID"
              />
            ) : (
              <Skeleton width={104} height={16} animation="wave" />
            )}
          </SpanHeaderMetaItem>
          {hasLatencyPreview ? (
            typeof spanPreview.latencyMs === "number" ? (
              <SpanHeaderMetaItem>
                <Text size="S" color="text-500" fontFamily="mono">
                  {latencyMsFormatter(spanPreview.latencyMs)}
                </Text>
              </SpanHeaderMetaItem>
            ) : null
          ) : (
            <SpanHeaderMetaItem>
              <Skeleton width={54} height={16} animation="wave" />
            </SpanHeaderMetaItem>
          )}
          <SpanHeaderMetaItem>
            {spanPreview?.startTime !== undefined ? (
              <Text size="S" color="text-500" fontFamily="mono">
                {fullTimeFormatter(new Date(spanPreview.startTime))}
              </Text>
            ) : (
              <Skeleton width={168} height={16} animation="wave" />
            )}
          </SpanHeaderMetaItem>
          {hasTokenCountPreview ? (
            spanPreview.tokenCountTotal ? (
              <SpanHeaderMetaItem>
                <SpanTokenCount
                  tokenCountTotal={spanPreview.tokenCountTotal}
                  nodeId={spanPreview.id}
                  size="S"
                  color="text-500"
                />
              </SpanHeaderMetaItem>
            ) : null
          ) : (
            <SpanHeaderMetaItem>
              <Skeleton width={64} height={16} animation="wave" />
            </SpanHeaderMetaItem>
          )}
        </SpanHeaderMetaRow>
      </Flex>
    </View>
  );
}

/** Loading state for trace or span annotation rows. */
export function DetailPanelAnnotationBarSkeleton() {
  return (
    <div css={annotationBarSkeletonCSS} aria-busy="true">
      <Skeleton width={68} height={16} animation="wave" />
      <Skeleton width={112} height={24} animation="wave" />
      <Skeleton width={92} height={24} animation="wave" />
      <Skeleton width={132} height={24} animation="wave" />
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
