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
  COMPACT_BREAKPOINT,
  LINE_GAP,
  nestingLevelStyle,
  spanControlsCSS,
  spanNodeWrapCSS,
  spanTimingCSS,
  traceTreeListCSS,
  TREE_ICON_Z_INDEX,
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

const skeletonListCSS = css`
  overflow: hidden;
  --trace-tree-line-color: var(--global-skeleton-line-color);
`;

/**
 * Where a row's icon, name and metrics will be, as one block that spans the
 * title line and, when metrics are shown, the footer beneath it.
 */
const spanLabelSkeletonCSS = css`
  flex: 1 1 0%;
  min-width: 0;
  /* Above the elbow that ends at the block's left edge */
  position: relative;
  z-index: ${TREE_ICON_Z_INDEX};
  .skeleton {
    max-width: 100%;
    height: var(--trace-tree-heading-height);
  }
  &[data-show-metrics="true"] .skeleton {
    height: calc(
      var(--trace-tree-heading-height) + var(--global-dimension-size-25) +
        var(--global-line-height-xs)
    );
  }
  @container (width < ${COMPACT_BREAKPOINT}) {
    &[data-show-metrics="true"] .skeleton {
      height: var(--trace-tree-heading-height);
    }
  }
`;

const skeletonRowCSS = css`
  /* The block runs below the title line, so the drop to the first child
     starts under the block instead of under an icon */
  & > .span-tree-drop {
    top: calc(100% - var(--trace-tree-row-padding-y) + ${LINE_GAP}px);
  }
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
        css={[traceTreeListCSS, skeletonListCSS]}
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
   * Width of the block that stands in for the span's icon, name and metrics.
   * Pass a number (px) or CSS length.
   * @default 210
   */
  width?: number | string;
  /**
   * Nested `TraceTreeNodeSkeleton` children. Nesting level is threaded via
   * context so callers don't need to pass it explicitly.
   */
  children?: ReactNode;
}

export function TraceTreeNodeSkeleton({
  width = 210,
  children,
}: TraceTreeNodeSkeletonProps) {
  const nestingLevel = useContext(NestingLevelContext);
  const childArray = Children.toArray(children).filter(isValidElement);
  const hasChildren = childArray.length > 0;

  return (
    <Fragment>
      <SpanNodeRowSkeleton
        nestingLevel={nestingLevel}
        width={width}
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
  width,
  hasChildren,
}: {
  nestingLevel: number;
  width: number | string;
  hasChildren: boolean;
}) {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  return (
    <div
      className="span-node-wrap"
      css={[spanNodeWrapCSS, skeletonRowCSS]}
      style={nestingLevelStyle(nestingLevel)}
    >
      {nestingLevel > 0 ? <SpanTreeEdge /> : null}
      {hasChildren ? <SpanTreeDrop /> : null}
      <div
        css={spanLabelSkeletonCSS}
        data-show-metrics={showMetricsInTraceTree}
      >
        <Skeleton width={width} />
      </div>
      {showMetricsInTraceTree ? (
        <div css={spanTimingCSS} className="span-tree-timing">
          <Skeleton width="100%" height={6} />
        </div>
      ) : null}
      <div css={spanControlsCSS} className="span-controls">
        {hasChildren ? <Skeleton width={20} height={20} /> : null}
      </div>
    </div>
  );
}

function DefaultTraceTreeSkeletonBody() {
  return (
    <TraceTreeNodeSkeleton width={230}>
      <TraceTreeNodeSkeleton width={150}>
        <TraceTreeNodeSkeleton width={240}>
          <TraceTreeNodeSkeleton width={170} />
          <TraceTreeNodeSkeleton width={260}>
            <TraceTreeNodeSkeleton width={150} />
          </TraceTreeNodeSkeleton>
        </TraceTreeNodeSkeleton>
        <TraceTreeNodeSkeleton width={120} />
      </TraceTreeNodeSkeleton>
      <TraceTreeNodeSkeleton width={230}>
        <TraceTreeNodeSkeleton width={140} />
      </TraceTreeNodeSkeleton>
    </TraceTreeNodeSkeleton>
  );
}
