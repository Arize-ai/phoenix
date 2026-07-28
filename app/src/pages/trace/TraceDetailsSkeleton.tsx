import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import { Flex, Loading, Text, View } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";

import { DetailsPanel } from "./DetailsPanel";

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
  border-left: 4px solid transparent;

  .trace-tree-entity-skeleton__id {
    flex: none;
    margin-left: auto;
  }
`;

const spanHeaderIdentitySkeletonCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;

  .span-header-skeleton__name {
    flex: 0 1 240px;
    min-width: var(--global-dimension-size-600);
  }

  .span-header-skeleton__actions {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-left: auto;
  }
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
  treeAddonWidth,
  treeHeader,
  treeMaximumWidth,
}: {
  onPreferredTreeWidthChange: (width: number) => void;
  preferredTreeWidth: number;
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
            <TraceTreeNavigationSkeleton />
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

function TraceTreeNavigationSkeleton() {
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
export function SpanDetailsSkeleton() {
  return (
    <Flex direction="column" flex="1 1 auto" height="100%" aria-busy="true">
      <SpanHeaderSkeleton />
      <DetailPanelAnnotationBarSkeleton />
      <SpanDetailsContentSkeleton />
    </Flex>
  );
}

/** Keeps the two-row span identity header stable while its metadata loads. */
export function SpanHeaderSkeleton() {
  return (
    <View
      paddingTop="size-100"
      paddingBottom="size-100"
      paddingStart="size-150"
      paddingEnd="size-200"
      flex="none"
    >
      <Flex direction="column" gap="size-50" width="100%">
        <div css={spanHeaderIdentitySkeletonCSS}>
          <Skeleton width={54} height={24} animation="wave" />
          <Skeleton
            className="span-header-skeleton__name"
            height={22}
            animation="wave"
          />
          <Skeleton width={72} height={24} animation="wave" />
          <div className="span-header-skeleton__actions">
            <Skeleton width={32} height={32} animation="wave" />
            <Skeleton width={32} height={32} animation="wave" />
            <Skeleton width={32} height={32} animation="wave" />
          </div>
        </div>
        <Flex direction="row" gap="size-100" alignItems="center" wrap>
          <Skeleton width={104} height={16} animation="wave" />
          <Skeleton width={54} height={16} animation="wave" />
          <Skeleton width={168} height={16} animation="wave" />
          <Skeleton width={64} height={16} animation="wave" />
        </Flex>
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
        </ul>
      </nav>
      <Flex flex="1 1 auto" minHeight={0}>
        <Loading />
      </Flex>
    </Flex>
  );
}
