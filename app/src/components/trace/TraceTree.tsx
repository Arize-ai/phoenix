import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { startTransition, useEffect, useRef, useState } from "react";

import {
  DisclosureArrow,
  Empty,
  Flex,
  Icon,
  Icons,
  Text,
} from "@phoenix/components";
import type { TimelineBarProps } from "@phoenix/components/timeline/TimelineBar";
import { TimelineBar } from "@phoenix/components/timeline/TimelineBar";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import { useSpanKindColor } from "@phoenix/components/trace/useSpanKindColor";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";
import { classNames } from "@phoenix/utils/classNames";

import { LatencyText } from "./LatencyText";
import { SpanKindIcon } from "./SpanKindIcon";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import { useTraceTree } from "./TraceTreeContext";
import { NESTING_INDENT, traceTreeListCSS } from "./traceTreeStyles";
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
    setIsCollapsed(treeIsCollapsed);
  }, [treeIsCollapsed]);

  const { name, latencyMs, statusCode, tokenCountTotal } = node.span;
  return (
    <div ref={itemRef}>
      <div
        role="button"
        tabIndex={0}
        css={css`
          width: 100%;
          overflow: hidden;
          cursor: pointer;
        `}
        onClick={() => {
          startTransition(() => {
            if (onSpanClick) {
              onSpanClick(node.span);
            }
          });
        }}
      >
        <SpanNodeWrap
          isSelected={selectedSpanNodeId === node.span.id}
          nestingLevel={nestingLevel}
        >
          <Flex
            direction="row"
            gap="size-100"
            justifyContent="start"
            alignItems="center"
            flex="1 1 auto"
            minWidth={0}
            css={css`
              overflow: hidden;
            `}
          >
            <SpanKindIcon spanKind={node.span.spanKind} />
            <span css={spanNameCSS} title={name}>
              {name}
            </span>
            {statusCode === "ERROR" ? (
              <SpanStatusCodeIcon
                statusCode="ERROR"
                css={css`
                  font-size: var(--global-font-size-m);
                `}
              />
            ) : null}
            {typeof tokenCountTotal === "number" &&
            tokenCountTotal > 0 &&
            showMetricsInTraceTree ? (
              <SpanTokenCount
                tokenCountTotal={tokenCountTotal}
                nodeId={node.span.id}
              />
            ) : null}
          </Flex>
          {showMetricsInTraceTree ? (
            <div css={spanTimingCSS} className="span-tree-timing">
              {latencyMs != null ? (
                <LatencyText
                  latencyMs={latencyMs}
                  showIcon={false}
                  size="XS"
                  color="text-500"
                />
              ) : null}
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
              >
                {nexSibling ? (
                  <SpanTreeEdgeConnector
                    {...nexSibling.span}
                    nestingLevel={nestingLevel}
                  />
                ) : null}
                <SpanTreeEdge {...leafNode.span} nestingLevel={nestingLevel} />
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

function SpanNodeWrap(
  props: PropsWithChildren<{ isSelected: boolean; nestingLevel: number }>
) {
  return (
    <div
      className={classNames("span-node-wrap", {
        "is-selected": props.isSelected,
      })}
      css={css`
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: var(--global-dimension-size-100);
        padding-right: var(--global-dimension-size-100);
        padding-top: var(--global-dimension-size-100);
        padding-bottom: var(--global-dimension-size-100);
        border-left: 4px solid transparent;
        box-sizing: border-box;
        &:hover {
          background-color: var(--global-color-gray-75);
        }
        &.is-selected {
          // Keep the fill translucent so the latency bar remains visible
          background-color: rgba(var(--global-color-gray-200-rgb), 0.5);
          border-color: var(--global-color-gray-300);
        }
        & > *:first-of-type {
          margin-left: calc(
            (${props.nestingLevel} * var(--trace-tree-nesting-indent)) + 16px
          );
        }
      `}
    >
      {props.children}
    </div>
  );
}

/**
 * The line that connects the parent node to the child node edge
 */
function SpanTreeEdgeConnector({
  statusCode,
  nestingLevel,
}: {
  statusCode: SpanStatusCodeType;
  nestingLevel: number;
}) {
  const isError = statusCode === "ERROR";
  return (
    <div
      aria-hidden="true"
      data-testid="span-tree-edge-connector"
      className="span-tree-edge-connector"
      data-status-code={statusCode}
      css={css`
        position: absolute;
        border-left: 1px solid
          ${isError
            ? "var(--global-color-danger)"
            : "var(--global-color-gray-300)"};
        z-index: ${isError ? 1 : 0};
        top: 0;
        left: ${nestingLevel * NESTING_INDENT + 29}px;
        width: 42px;
        bottom: 0;
        z-index: 1;
      `}
    ></div>
  );
}

function SpanTreeEdge({
  nestingLevel,
  statusCode,
}: {
  statusCode: SpanStatusCodeType;
  nestingLevel: number;
}) {
  const isError = statusCode === "ERROR";
  const color = isError
    ? "var(--global-color-danger)"
    : "var(--global-color-gray-300)";
  const zIndex = isError ? 1 : 0;
  return (
    <div
      aria-hidden="true"
      className="span-tree-edge"
      css={css`
        position: absolute;
        border-left: 1px solid ${color};
        border-bottom: 1px solid ${color};
        z-index: ${zIndex};
        border-radius: 0 0 0 11px;
        top: -5px;
        left: ${nestingLevel * NESTING_INDENT + 29}px;
        width: 11px;
        height: 22px;
      `}
    ></div>
  );
}

const spanControlsCSS = css`
  width: 20px;
  flex: none;
`;

const spanTimingCSS = css`
  gap: var(--global-dimension-size-100);
  width: 150px;
  flex: none;
  display: flex;
  flex-direction: row;
  align-items: center;
  .latency-text {
    justify-content: end !important;
    min-width: 2.5rem;
    float: right;
  }
`;

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
