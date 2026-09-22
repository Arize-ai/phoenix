import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { startTransition, useEffect, useRef, useState } from "react";
import { Focusable } from "react-aria";

import {
  DisclosureArrow,
  Empty,
  Flex,
  Icon,
  Icons,
  Text,
  TooltipTrigger,
} from "@phoenix/components";
import type { TimelineBarProps } from "@phoenix/components/timeline/TimelineBar";
import { TimelineBar } from "@phoenix/components/timeline/TimelineBar";
import { useSpanKindColor } from "@phoenix/components/trace/useSpanKindColor";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { classNames } from "@phoenix/utils/classNames";

import { SpanKindIcon } from "./SpanKindIcon";
import { SpanMetricsRow } from "./SpanMetricsRow";
import { SpanPreviewTooltip } from "./SpanPreviewTooltip";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import { useTraceTree } from "./TraceTreeContext";
import {
  SpanTreeDrop,
  SpanTreeEdge,
  SpanTreeEdgeConnector,
} from "./TraceTreeEdges";
import {
  nestingLevelStyle,
  spanControlsCSS,
  spanNodeContentCSS,
  spanNodeIconCSS,
  spanNodeWrapCSS,
  spanTimingCSS,
  traceTreeListCSS,
} from "./traceTreeStyles";
import type { ISpanItem, SpanStatusCodeType } from "./types";
import type { SpanTreeNode } from "./utils";
import { createSpanTree, filterSpanTree } from "./utils";

export type TraceTreeProps = {
  spans: ISpanItem[];
  onSpanClick?: (span: ISpanItem) => void;
  selectedSpanNodeId: string;
  scrollSelectedSpanIntoView?: boolean;
};

export { TraceTreeProvider } from "./TraceTreeContext";

export function TraceTree(props: TraceTreeProps) {
  const {
    spans,
    onSpanClick,
    selectedSpanNodeId,
    scrollSelectedSpanIntoView = true,
  } = props;
  const { searchQuery } = useTraceTree();
  const spanTree = createSpanTree(spans);
  const filteredSpanTree = filterSpanTree(spanTree, searchQuery);
  const rootSpan = spanTree[0]?.span;
  const hasSearchQuery = searchQuery.length > 0;
  const noSearchResults = hasSearchQuery && filteredSpanTree.length === 0;
  const overallTimeRange = {
    start: rootSpan ? new Date(rootSpan.startTime) : new Date(),
    end: rootSpan?.endTime ? new Date(rootSpan.endTime) : new Date(),
  };
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        overflow: hidden;
        flex: 1 1 auto;
        min-height: 0;
        align-items: stretch;
        container-type: inline-size;
      `}
    >
      <ul
        css={[
          traceTreeListCSS,
          css`
            overflow: auto;
          `,
        ]}
        data-testid="trace-tree"
      >
        {noSearchResults ? (
          <li aria-live="polite">
            <TraceTreeSearchEmpty searchQuery={searchQuery} />
          </li>
        ) : null}
        {!rootSpan ? (
          <li>
            <Empty message="No spans" size="S" />
          </li>
        ) : null}
        {filteredSpanTree.map((spanNode) => (
          <SpanTreeItem
            key={spanNode.span.id}
            node={spanNode}
            overallTimeRange={overallTimeRange}
            onSpanClick={onSpanClick}
            selectedSpanNodeId={selectedSpanNodeId}
            scrollSelectedSpanIntoView={scrollSelectedSpanIntoView}
          />
        ))}
      </ul>
    </div>
  );
}

function TraceTreeSearchEmpty({ searchQuery }: { searchQuery: string }) {
  return (
    <div
      className="trace-tree-search-empty"
      css={css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--global-dimension-size-50);
        padding: var(--global-dimension-size-300)
          var(--global-dimension-size-200);
        color: var(--global-text-color-700);
        text-align: center;

        .icon-wrap {
          font-size: var(--global-font-size-l);
          color: var(--global-text-color-500);
        }

        .text {
          max-width: 180px;
          text-wrap: balance;
        }
      `}
    >
      <Icon svg={<Icons.Trace />} />
      <Text color="inherit" size="XS">
        {`No spans match "${searchQuery}"`}
      </Text>
    </div>
  );
}

const spanNameCSS = css`
  font-weight: 500;
  color: var(--global-text-color-900);
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface SpanTreeItemProps<TSpan extends ISpanItem> {
  node: SpanTreeNode<TSpan>;
  selectedSpanNodeId: string;
  scrollSelectedSpanIntoView: boolean;
  overallTimeRange: TimeRange;
  onSpanClick?: (span: ISpanItem) => void;
  /**
   * How deep the item is nested in the tree. Starts at 0.
   * @default 0
   */
  nestingLevel?: number;
}

function SpanTreeItem<TSpan extends ISpanItem>(
  props: SpanTreeItemProps<TSpan>
) {
  const {
    node,
    selectedSpanNodeId,
    scrollSelectedSpanIntoView,
    onSpanClick,
    nestingLevel = 0,
    overallTimeRange,
  } = props;
  const childNodes = node.children;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCollapsed: treeIsCollapsed, searchQuery } = useTraceTree();
  const hasChildren = childNodes.length > 0;
  const isSearching = searchQuery.length > 0;
  const effectiveIsCollapsed = isSearching ? false : isCollapsed;
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const isSelected = selectedSpanNodeId === node.span.id;
  const itemRef = useRef<HTMLDivElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (scrollSelectedSpanIntoView && isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isSelected, scrollSelectedSpanIntoView]);

  // React to global changes to the trace tree state and change local state
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setIsCollapsed(treeIsCollapsed);
  }, [treeIsCollapsed]);

  const { name, latencyMs, statusCode, tokenCountTotal, costSummary } =
    node.span;
  return (
    <div ref={itemRef}>
      {/* The row is the tooltip's trigger: hover or focus it and the span's
          preview opens beside it. The short delay keeps a scrub down the
          tree from opening (and fetching) a preview for every row passed. */}
      <TooltipTrigger delay={SPAN_PREVIEW_DELAY_MS} closeDelay={0}>
        <Focusable>
          <div
            role="button"
            tabIndex={0}
            css={spanNodeButtonCSS}
            onClick={() => {
              startTransition(() => {
                if (onSpanClick) {
                  onSpanClick(node.span);
                }
              });
            }}
          >
            <SpanNodeWrap
              isSelected={isSelected}
              nestingLevel={nestingLevel}
              statusCode={statusCode}
              dropStatusCode={
                hasChildren && !effectiveIsCollapsed
                  ? childNodes[0].span.statusCode
                  : undefined
              }
            >
              <div css={spanNodeIconCSS} className="span-node__icon">
                <SpanKindIcon spanKind={node.span.spanKind} />
              </div>
              <div css={spanNodeContentCSS} className="span-node__content">
                <Flex
                  direction="row"
                  gap="size-100"
                  alignItems="center"
                  minWidth={0}
                  height="var(--trace-tree-heading-height)"
                  className="span-node__heading"
                >
                  <span css={spanNameCSS}>{name}</span>
                  {statusCode === "ERROR" ? (
                    <SpanStatusCodeIcon
                      statusCode="ERROR"
                      css={css`
                        font-size: var(--global-font-size-m);
                        flex: none;
                      `}
                    />
                  ) : null}
                </Flex>
                {showMetricsInTraceTree ? (
                  <SpanMetricsRow
                    size="XS"
                    latencyMs={latencyMs}
                    tokenCountTotal={tokenCountTotal}
                    costTotal={costSummary?.total?.cost}
                  />
                ) : null}
              </div>
              {showMetricsInTraceTree ? (
                <div css={spanTimingCSS} className="span-tree-timing">
                  <SpanTimelineBar
                    spanKind={node.span.spanKind}
                    overallTimeRange={overallTimeRange}
                    spanTimeRange={{
                      start: new Date(node.span.startTime),
                      end: node.span.endTime
                        ? new Date(node.span.endTime)
                        : new Date(), // Assume un-closed
                    }}
                  />
                </div>
              ) : null}
              <div
                css={spanControlsCSS}
                data-testid="span-controls"
                className="span-controls"
              >
                {hasChildren && !isSearching ? (
                  <CollapseToggleButton
                    isCollapsed={isCollapsed}
                    onClick={() => {
                      setIsCollapsed(!isCollapsed);
                    }}
                  />
                ) : null}
              </div>
            </SpanNodeWrap>
          </div>
        </Focusable>
        <SpanPreviewTooltip span={node.span} />
      </TooltipTrigger>
      {childNodes.length ? (
        <ul
          css={css`
            display: ${effectiveIsCollapsed ? "none" : "flex"};
            flex-direction: column;
          `}
        >
          {childNodes.map((leafNode, index) => {
            // The last child does not need an edge connector, a line to connect the nodes
            // after to the parent node
            const nexSibling = childNodes[index + 1];
            return (
              <li
                key={leafNode.span.spanId}
                css={css`
                  position: relative;
                `}
                style={nestingLevelStyle(nestingLevel)}
              >
                {nexSibling ? (
                  <SpanTreeEdgeConnector
                    statusCode={nexSibling.span.statusCode}
                  />
                ) : null}
                <SpanTreeItem
                  node={leafNode}
                  overallTimeRange={overallTimeRange}
                  onSpanClick={onSpanClick}
                  selectedSpanNodeId={selectedSpanNodeId}
                  scrollSelectedSpanIntoView={scrollSelectedSpanIntoView}
                  nestingLevel={nestingLevel + 1}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * How long the pointer rests on a row before its preview opens. React Aria
 * warms up after the first: moving to the next row then opens at once.
 */
const SPAN_PREVIEW_DELAY_MS = 150;

const spanNodeButtonCSS = css`
  width: 100%;
  cursor: pointer;
`;

/*
 * The tree sits on a gray-75 surface, so the fills step up from there: a
 * hovered row reads clearly against the surface and the row its preview
 * describes is unmistakable, and the selected row steps up once more so it
 * still stands out from a hovered neighbor. Both stay translucent so the
 * latency bar shows through.
 */
const selectableRowCSS = css`
  ${spanNodeWrapCSS}
  &:hover,
  :focus-visible > & {
    background-color: rgba(var(--global-color-gray-200-rgb), 0.6);
  }
  &.is-selected {
    background-color: rgba(var(--global-color-gray-300-rgb), 0.5);
    border-color: var(--global-color-gray-300);
  }
`;

function SpanNodeWrap(
  props: PropsWithChildren<{
    isSelected: boolean;
    nestingLevel: number;
    /** Status of this span; colors the elbow joining it to its parent. */
    statusCode: SpanStatusCodeType;
    /**
     * Status of the first visible child, when there is one. Draws the line
     * that drops from this row's icon to its children.
     */
    dropStatusCode?: SpanStatusCodeType;
  }>
) {
  const { isSelected, nestingLevel, statusCode, dropStatusCode, children } =
    props;
  return (
    <div
      className={classNames("span-node-wrap", {
        "is-selected": isSelected,
      })}
      css={selectableRowCSS}
      style={nestingLevelStyle(nestingLevel)}
    >
      {nestingLevel > 0 ? <SpanTreeEdge statusCode={statusCode} /> : null}
      {dropStatusCode ? <SpanTreeDrop statusCode={dropStatusCode} /> : null}
      {children}
    </div>
  );
}

const collapseButtonCSS = css`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--global-text-color-900);
  border-radius: 4px;
  transition: background-color 0.5s;
  flex: none;
  background-color: rgba(0, 0, 0, 0.05);
  &:hover {
    background-color: rgba(0, 0, 0, 0.15);
  }
`;

function CollapseToggleButton({
  isCollapsed,
  onClick,
}: {
  isCollapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      className="button--reset collapse-toggle-button"
      css={collapseButtonCSS}
    >
      <DisclosureArrow isExpanded={!isCollapsed} />
    </button>
  );
}

function SpanTimelineBar({
  spanKind,
  ...props
}: Omit<TimelineBarProps, "color"> & { spanKind: string }) {
  const color = useSpanKindColor({ spanKind });
  return <TimelineBar color={color} {...props} />;
}
