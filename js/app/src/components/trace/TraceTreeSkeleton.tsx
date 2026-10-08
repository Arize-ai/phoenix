import { css } from "@emotion/react";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  type ReactNode,
  useContext,
} from "react";

import { Skeleton } from "@phoenix/components/core/loading/Skeleton";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import {
  SpanTreeDrop,
  SpanTreeEdge,
  SpanTreeEdgeConnector,
} from "./TraceTreeEdges";
import {
  headingLineCSS,
  nestingLevelStyle,
  spanControlsCSS,
  spanNodeContentCSS,
  spanNodeIconCSS,
  spanNodeWrapCSS,
  spanTimingCSS,
  traceTreeListCSS,
} from "./traceTreeStyles";

const NestingLevelContext = createContext(0);

const containerCSS = css`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  align-items: stretch;
  container-type: inline-size;
`;

const listOverflowCSS = css`
  overflow: hidden;
`;

export interface TraceTreeSkeletonProps {
  children?: ReactNode;
}

/**
 * Skeleton placeholder for `TraceTree`. Accepts `TraceTreeNodeSkeleton`
 * children to shape the tree, or renders a default tree when empty.
 *
 * Rows share their layout styles and tree lines with the real tree, so the
 * skeleton cannot drift from what it stands in for.
 */
export function TraceTreeSkeleton({ children }: TraceTreeSkeletonProps) {
  return (
    <div css={containerCSS}>
      <ul
        css={[traceTreeListCSS, listOverflowCSS]}
        data-testid="trace-tree-skeleton"
        aria-busy="true"
      >
        {children ?? <DefaultTraceTreeSkeletonBody />}
      </ul>
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
                  style={nestingLevelStyle(nestingLevel)}
                >
                  {hasSiblingBelow ? <SpanTreeEdgeConnector /> : null}
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
    <div
      className="span-node-wrap"
      css={spanNodeWrapCSS}
      style={nestingLevelStyle(nestingLevel)}
    >
      {nestingLevel > 0 ? <SpanTreeEdge /> : null}
      {hasChildren ? <SpanTreeDrop /> : null}
      <div css={spanNodeIconCSS}>
        <Skeleton width={20} height={20} borderRadius="S" animation="wave" />
      </div>
      <div css={spanNodeContentCSS}>
        <div css={headingLineCSS}>
          <Skeleton
            width={nameWidth}
            height={14}
            borderRadius="S"
            animation="wave"
          />
        </div>
        {showMetricsInTraceTree ? (
          <Skeleton
            width={72}
            height={10}
            borderRadius="S"
            animation="wave"
            className="span-metrics"
          />
        ) : null}
      </div>
      {showMetricsInTraceTree ? (
        <div css={spanTimingCSS} className="span-tree-timing">
          <Skeleton width="100%" height={6} borderRadius={3} animation="wave" />
        </div>
      ) : null}
      <div css={spanControlsCSS} className="span-controls">
        {hasChildren ? (
          <Skeleton width={20} height={20} borderRadius="S" animation="wave" />
        ) : null}
      </div>
    </div>
  );
}

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
