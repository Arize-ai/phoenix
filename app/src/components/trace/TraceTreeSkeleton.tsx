import { css } from "@emotion/react";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
  useContext,
} from "react";

import { Flex } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading/Skeleton";
import {
  TRACE_TREE_LATENCY_WIDTH_PIXELS,
  TRACE_TREE_NAME_MAX_WIDTH_PIXELS,
  TRACE_TREE_TIMING_MAX_WIDTH_PIXELS,
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
} from "@phoenix/components/trace/traceTreeSizing";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import {
  TRACE_TREE_CHILD_NESTING_INDENT_PIXELS,
  TRACE_TREE_ROW_SELECTION_BORDER_WIDTH,
  traceTreeListCSS,
} from "./traceTreeStyles";

const NestingLevelContext = createContext(0);

const containerCSS = css`
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  align-items: stretch;
  container-type: inline-size;

  &[data-navigation-mode="compact"] .trace-tree-skeleton__full {
    visibility: hidden;
  }
`;

const fullSkeletonCSS = css`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
`;

const listOverflowCSS = css`
  overflow: hidden;
`;

const compactSkeletonIconRailCSS = css`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;

  li {
    box-sizing: border-box;
    display: flex;
    flex: 0 0 var(--global-details-panel-navigation-row-height);
    align-items: center;
    padding-left: var(
      --global-details-panel-navigation-row-content-padding-inline-start
    );
  }
`;

export interface TraceTreeSkeletonProps {
  children?: ReactNode;
  /** Whether to replace the full-width skeleton with a compact icon rail. */
  isNavigationCollapsed?: boolean;
}

/**
 * Skeleton placeholder for `TraceTree`. Accepts `TraceTreeNodeSkeleton`
 * children to shape the tree, or renders a default tree when empty.
 */
export function TraceTreeSkeleton({
  children,
  isNavigationCollapsed = false,
}: TraceTreeSkeletonProps) {
  return (
    <div
      css={containerCSS}
      data-navigation-mode={isNavigationCollapsed ? "compact" : "full"}
    >
      <div
        className="trace-tree-skeleton__full"
        css={fullSkeletonCSS}
        aria-hidden={isNavigationCollapsed || undefined}
      >
        <ul
          css={[traceTreeListCSS, listOverflowCSS]}
          data-testid="trace-tree-skeleton"
          aria-busy="true"
        >
          {children ?? <DefaultTraceTreeSkeletonBody />}
        </ul>
      </div>
      {isNavigationCollapsed ? (
        <ul
          aria-label="Loading trace navigation"
          aria-busy="true"
          css={compactSkeletonIconRailCSS}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <li key={index}>
              <Skeleton
                width={20}
                height={20}
                borderRadius="S"
                animation="wave"
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export interface TraceTreeNodeSkeletonProps {
  /**
   * Width of the span-name placeholder. Pass a number (px) or CSS length.
   * @default 180
   */
  nameWidth?: number | string;
  /**
   * Nested `TraceTreeNodeSkeleton` children. Nesting level is threaded via
   * context so callers don't need to pass it explicitly.
   */
  children?: ReactNode;
}

export function TraceTreeNodeSkeleton({
  nameWidth = 180,
  children,
}: TraceTreeNodeSkeletonProps) {
  const nestingLevel = useContext(NestingLevelContext);
  const childArray = Children.toArray(children).filter(isValidElement);
  const hasChildren = childArray.length > 0;

  return (
    <Fragment>
      <SpanNodeRowSkeleton
        nestingLevel={nestingLevel}
        nameWidth={nameWidth}
        hasChildren={hasChildren}
      />
      {hasChildren ? (
        <ul
          css={css`
            display: flex;
            flex-direction: column;
          `}
        >
          <NestingLevelContext.Provider value={nestingLevel + 1}>
            {childArray.map((child, index) => {
              const hasSiblingBelow = index < childArray.length - 1;
              return (
                <li
                  key={index}
                  css={css`
                    position: relative;
                  `}
                >
                  {hasSiblingBelow ? (
                    <EdgeConnectorSkeleton nestingLevel={nestingLevel} />
                  ) : null}
                  <EdgeSkeleton nestingLevel={nestingLevel} />
                  {child}
                </li>
              );
            })}
          </NestingLevelContext.Provider>
        </ul>
      ) : null}
    </Fragment>
  );
}

function SpanNodeRowSkeleton({
  nestingLevel,
  nameWidth,
  hasChildren,
}: {
  nestingLevel: number;
  nameWidth: number | string;
  hasChildren: boolean;
}) {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  return (
    <SpanNodeWrapSkeleton nestingLevel={nestingLevel}>
      <Flex
        className="span-tree-name"
        direction="row"
        gap="size-100"
        justifyContent="start"
        alignItems="center"
        flex={`1 1 ${TRACE_TREE_NAME_MAX_WIDTH_PIXELS}px`}
        minWidth={0}
        maxWidth={`${TRACE_TREE_NAME_MAX_WIDTH_PIXELS}px`}
        css={css`
          overflow: hidden;
        `}
      >
        <Skeleton width={20} height={20} borderRadius="S" animation="wave" />
        <Skeleton
          width={nameWidth}
          height={14}
          borderRadius="S"
          animation="wave"
        />
      </Flex>
      {showMetricsInTraceTree ? (
        <div css={spanTimingCSS} className="span-tree-timing">
          <Skeleton width={36} height={10} borderRadius="S" animation="wave" />
          <Flex flex="1 1 auto">
            <Skeleton
              width="100%"
              height={6}
              borderRadius={3}
              animation="wave"
            />
          </Flex>
        </div>
      ) : null}
      <div css={spanControlsCSS} className="span-controls">
        {hasChildren ? (
          <Skeleton width={20} height={20} borderRadius="S" animation="wave" />
        ) : null}
      </div>
    </SpanNodeWrapSkeleton>
  );
}

function SpanNodeWrapSkeleton(
  props: PropsWithChildren<{ nestingLevel: number }>
) {
  return (
    <div
      className="span-node-wrap"
      css={css`
        width: 100%;
        height: var(--global-details-panel-navigation-row-height);
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: var(--global-dimension-size-100);
        padding-right: var(--global-dimension-size-100);
        padding-top: 0;
        padding-bottom: 0;
        border-left: ${TRACE_TREE_ROW_SELECTION_BORDER_WIDTH} solid transparent;
        box-sizing: border-box;
        & > *:first-of-type {
          box-sizing: border-box;
          padding-left: calc(
            (${props.nestingLevel} * var(--trace-tree-child-nesting-indent)) +
              var(
                --global-details-panel-navigation-row-content-padding-inline-start
              )
          );
        }
      `}
    >
      {props.children}
    </div>
  );
}

function EdgeConnectorSkeleton({ nestingLevel }: { nestingLevel: number }) {
  return (
    <div
      className="span-tree-edge-connector"
      css={css`
        position: absolute;
        border-left: 1px solid var(--global-color-gray-300);
        top: 0;
        left: calc(
          ${nestingLevel * TRACE_TREE_CHILD_NESTING_INDENT_PIXELS}px +
            var(
              --global-details-panel-navigation-row-content-padding-inline-start
            ) +
            13px
        );
        width: 42px;
        bottom: 0;
        z-index: 1;
      `}
    />
  );
}

function EdgeSkeleton({ nestingLevel }: { nestingLevel: number }) {
  return (
    <div
      className="span-tree-edge"
      css={css`
        position: absolute;
        border-left: 1px solid var(--global-color-gray-300);
        border-bottom: 1px solid var(--global-color-gray-300);
        border-radius: 0 0 0 11px;
        top: -5px;
        left: calc(
          ${nestingLevel * TRACE_TREE_CHILD_NESTING_INDENT_PIXELS}px +
            var(
              --global-details-panel-navigation-row-content-padding-inline-start
            ) +
            13px
        );
        width: 11px;
        height: 22px;
      `}
    />
  );
}

const spanControlsCSS = css`
  width: 20px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const spanTimingCSS = css`
  gap: var(--global-dimension-size-100);
  min-width: ${TRACE_TREE_TIMING_MIN_WIDTH_PIXELS}px;
  max-width: ${TRACE_TREE_TIMING_MAX_WIDTH_PIXELS}px;
  flex: 1 1 ${TRACE_TREE_TIMING_MIN_WIDTH_PIXELS}px;
  display: grid;
  grid-template-columns: ${TRACE_TREE_LATENCY_WIDTH_PIXELS}px minmax(0, 1fr);
  align-items: center;

  & > *:last-child {
    grid-column: 2;
    min-width: 0;
  }
`;

function DefaultTraceTreeSkeletonBody() {
  return (
    <TraceTreeNodeSkeleton nameWidth={200}>
      <TraceTreeNodeSkeleton nameWidth={180}>
        <TraceTreeNodeSkeleton nameWidth={160}>
          <TraceTreeNodeSkeleton nameWidth={220} />
          <TraceTreeNodeSkeleton nameWidth={200}>
            <TraceTreeNodeSkeleton nameWidth={170} />
          </TraceTreeNodeSkeleton>
        </TraceTreeNodeSkeleton>
        <TraceTreeNodeSkeleton nameWidth={140} />
      </TraceTreeNodeSkeleton>
      <TraceTreeNodeSkeleton nameWidth={180}>
        <TraceTreeNodeSkeleton nameWidth={160} />
      </TraceTreeNodeSkeleton>
    </TraceTreeNodeSkeleton>
  );
}
