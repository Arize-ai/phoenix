import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { useEffect, useRef, useState } from "react";
import type { To } from "react-router";
import { Link } from "react-router";

import {
  DisclosureArrow,
  Empty,
  Flex,
  Icon,
  Icons,
  Text,
} from "@phoenix/components";
import { expandableContentExpandButtonCSS } from "@phoenix/components/core/content/ExpandableContent";
import { CopyableIDBadge } from "@phoenix/components/core/id";
import type { TimelineBarProps } from "@phoenix/components/timeline/TimelineBar";
import { TimelineBar } from "@phoenix/components/timeline/TimelineBar";
import { SpanTokenCount } from "@phoenix/components/trace/SpanTokenCount";
import {
  TRACE_TREE_LATENCY_WIDTH_PIXELS,
  TRACE_TREE_NAME_MAX_WIDTH_PIXELS,
  TRACE_TREE_TIMING_MAX_WIDTH_PIXELS,
  TRACE_TREE_TIMING_MIN_WIDTH_PIXELS,
} from "@phoenix/components/trace/traceTreeSizing";
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
  /**
   * Whether large child lists use Show more and Show less disclosure rows.
   * @default false
   */
  isChildTruncationEnabled?: boolean;
  session?: {
    sessionId: string;
    to: To;
  };
  traceSelection?: {
    isSelected: boolean;
    onSelect: () => void;
    traceId: string;
  };
  onSpanClick?: (span: ISpanItem) => void;
  onSpanSelectionStart?: (span: ISpanItem) => void;
  selectedSpanNodeId: string;
  scrollSelectedSpanIntoView?: boolean;
};

export { TraceTreeProvider } from "./TraceTreeContext";

const pendingSpanNavigationFrames = new WeakMap<
  Element,
  { first: number; second?: number }
>();

const SHALLOW_CHILD_LIMIT = 12;
const DEEP_CHILD_LIMIT = 8;
const SHOW_MORE_NODE_STATUS_CODE: SpanStatusCodeType = "UNSET";

function beginOptimisticSpanNavigation({
  onNavigate,
  spanNodeId,
  trigger,
}: {
  onNavigate: () => void;
  spanNodeId: string;
  trigger: HTMLElement;
}) {
  const tree = trigger.closest('[data-testid="trace-tree"]');
  if (!tree) {
    onNavigate();
    return;
  }

  tree
    .querySelectorAll<HTMLElement>(
      '[data-trace-tree-span-node-id][data-selected="true"]'
    )
    .forEach((node) => {
      node.dataset.selected = "false";
      node.classList.remove("is-selected");
    });
  const targetNode = trigger.querySelector<HTMLElement>(
    `[data-trace-tree-span-node-id="${CSS.escape(spanNodeId)}"]`
  );
  if (targetNode) {
    targetNode.dataset.selected = "true";
    targetNode.classList.add("is-selected");
  }

  const navigationScope =
    tree.closest('[data-testid="session-traces-view"]') ??
    tree.closest("main") ??
    document;
  const detailsGate = navigationScope.querySelector<HTMLElement>(
    "[data-span-details-state]"
  );
  if (detailsGate) {
    detailsGate.dataset.spanDetailsTargetId = spanNodeId;
    const retainedDetails = detailsGate.querySelectorAll<HTMLElement>(
      "[data-span-details-retained-id]"
    );
    const cachedTarget = detailsGate.querySelector<HTMLElement>(
      `[data-span-details-retained-id="${CSS.escape(spanNodeId)}"]`
    );
    retainedDetails.forEach((details) => details.setAttribute("hidden", ""));
    const skeleton = detailsGate.querySelector<HTMLElement>(
      "[data-span-details-skeleton]"
    );
    if (cachedTarget) {
      detailsGate.dataset.spanDetailsState = "hydrating";
      skeleton?.setAttribute("hidden", "");
      cachedTarget.removeAttribute("hidden");
    } else {
      detailsGate.dataset.spanDetailsState = "dehydrated";
      skeleton?.removeAttribute("hidden");
    }
  }

  const pendingFrames = pendingSpanNavigationFrames.get(tree);
  if (pendingFrames) {
    cancelAnimationFrame(pendingFrames.first);
    if (pendingFrames.second != null) {
      cancelAnimationFrame(pendingFrames.second);
    }
  }
  const nextFrames: { first: number; second?: number } = { first: 0 };
  nextFrames.first = requestAnimationFrame(() => {
    nextFrames.second = requestAnimationFrame(() => {
      pendingSpanNavigationFrames.delete(tree);
      onNavigate();
    });
  });
  pendingSpanNavigationFrames.set(tree, nextFrames);
}

/**
 * Builds the selected span's root-to-leaf path for keeping deep links visible
 * even when one of their sibling lists is truncated.
 *
 * @param params - Selected span path inputs.
 * @param params.spans - Flat spans rendered by the tree.
 * @param params.selectedSpanNodeId - Relay node id for the selected span.
 */
function getSelectedSpanPathNodeIds<TSpan extends ISpanItem>({
  spans,
  selectedSpanNodeId,
}: {
  spans: TSpan[];
  selectedSpanNodeId: string;
}) {
  const spansBySpanId = new Map(
    spans.map((span) => [span.spanId, span] as const)
  );
  const selectedSpan = spans.find((span) => span.id === selectedSpanNodeId);
  const selectedPathNodeIds = new Set<string>();
  let currentSpan = selectedSpan;

  while (currentSpan && !selectedPathNodeIds.has(currentSpan.id)) {
    selectedPathNodeIds.add(currentSpan.id);
    currentSpan = currentSpan.parentId
      ? spansBySpanId.get(currentSpan.parentId)
      : undefined;
  }

  return selectedPathNodeIds;
}

export function TraceTree(props: TraceTreeProps) {
  const {
    spans,
    isChildTruncationEnabled = false,
    session,
    traceSelection,
    onSpanClick,
    onSpanSelectionStart,
    selectedSpanNodeId,
    scrollSelectedSpanIntoView = true,
  } = props;
  const { searchQuery } = useTraceTree();
  const spanTree = createSpanTree(spans);
  const filteredSpanTree = filterSpanTree(spanTree, searchQuery);
  const selectedSpanPathNodeIds = getSelectedSpanPathNodeIds({
    spans,
    selectedSpanNodeId,
  });
  const rootSpan = spanTree[0]?.span;
  const hasSearchQuery = searchQuery.length > 0;
  const noSearchResults = hasSearchQuery && filteredSpanTree.length === 0;
  const overallTimeRange = {
    start: rootSpan ? new Date(rootSpan.startTime) : new Date(),
    end: rootSpan?.endTime ? new Date(rootSpan.endTime) : new Date(),
  };
  return (
    <div
      className="trace-tree-navigation"
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
            overflow-x: auto;
            overflow-y: var(--trace-tree-overflow-y, auto);
          `,
        ]}
        data-testid="trace-tree"
      >
        {session ? (
          <li>
            <SessionTreeItem sessionId={session.sessionId} to={session.to} />
          </li>
        ) : null}
        {traceSelection ? (
          <li>
            <TraceTreeItem {...traceSelection} />
          </li>
        ) : null}
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
            onSpanSelectionStart={onSpanSelectionStart}
            selectedSpanNodeId={selectedSpanNodeId}
            selectedSpanPathNodeIds={selectedSpanPathNodeIds}
            scrollSelectedSpanIntoView={scrollSelectedSpanIntoView}
            isChildTruncationEnabled={isChildTruncationEnabled}
          />
        ))}
      </ul>
    </div>
  );
}

const entityTreeItemCSS = css`
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100);
  padding-left: var(--global-dimension-size-200);
  border-left: 4px solid transparent;

  &:hover {
    background-color: var(--global-color-gray-75);
  }

  &[data-selected="true"] {
    background-color: rgba(var(--global-color-gray-200-rgb), 0.5);
    border-left-color: var(--global-color-gray-300);
  }

  .trace-tree-entity-item__action {
    position: absolute;
    inset: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
    text-decoration: none;
  }

  .trace-tree-entity-item__action:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }

  .trace-tree-entity-item__id {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    max-width: 120px;
    margin-left: auto;
    min-width: 0;
  }

  .trace-tree-entity-item__id > button {
    max-width: 100%;
  }

  .icon-wrap {
    flex: none;
    color: var(--global-text-color-700);
  }
`;

function SessionTreeItem({ sessionId, to }: { sessionId: string; to: To }) {
  return (
    <div css={entityTreeItemCSS}>
      <Link
        className="trace-tree-entity-item__action"
        to={to}
        aria-label={`View session ${sessionId}`}
      />
      <Icon aria-hidden="true" svg={<Icons.MessagesSquare />} />
      <Text size="S">Session</Text>
      <div className="trace-tree-entity-item__id">
        <CopyableIDBadge id={sessionId} tooltipText="Copy Session ID" />
      </div>
    </div>
  );
}

function TraceTreeItem({
  isSelected,
  onSelect,
  traceId,
}: {
  isSelected: boolean;
  onSelect: () => void;
  traceId: string;
}) {
  return (
    <div css={entityTreeItemCSS} data-selected={isSelected}>
      <button
        type="button"
        className="trace-tree-entity-item__action"
        aria-label={`View trace ${traceId}`}
        aria-pressed={isSelected}
        onClick={onSelect}
      />
      <Icon aria-hidden="true" svg={<Icons.Trace />} />
      <Text size="S">Trace</Text>
      <div className="trace-tree-entity-item__id">
        <CopyableIDBadge id={traceId} tooltipText="Copy Trace ID" />
      </div>
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

type ShowMoreTreeNode = {
  id: string;
  type: "show-more";
};

type ShowLessTreeNode = {
  id: "show-less";
  type: "show-less";
};

type SpanTreeRenderNode<TSpan> =
  | {
      type: "span";
      node: SpanTreeNode<TSpan>;
    }
  | ShowMoreTreeNode
  | ShowLessTreeNode;

/**
 * Returns the number of rows shown before a child list is truncated.
 *
 * @param params - Depth and limit configuration.
 * @param params.childNestingLevel - Zero-based nesting level of the child rows.
 * @param params.shallowChildLimit - Limit for child levels one and two.
 * @param params.deepChildLimit - Limit for child levels three and deeper.
 */
function getChildLimit({
  childNestingLevel,
  shallowChildLimit = SHALLOW_CHILD_LIMIT,
  deepChildLimit = DEEP_CHILD_LIMIT,
}: {
  childNestingLevel: number;
  shallowChildLimit?: number;
  deepChildLimit?: number;
}) {
  return childNestingLevel <= 1 ? shallowChildLimit : deepChildLimit;
}

function buildSpanRenderNodes<TSpan>({
  nodes,
}: {
  nodes: SpanTreeNode<TSpan>[];
}): SpanTreeRenderNode<TSpan>[] {
  return nodes.map((node) => ({ type: "span", node }));
}

/**
 * Builds a synthetic row for one omitted range.
 *
 * @param params - Omitted range inputs.
 * @param params.id - Stable position id within the parent list.
 * @param params.nodes - Direct children represented by the row.
 */
function buildShowMoreRenderNode<TSpan>({
  id,
  nodes,
}: {
  id: string;
  nodes: SpanTreeNode<TSpan>[];
}): ShowMoreTreeNode[] {
  return nodes.length > 0
    ? [
        {
          id,
          type: "show-more",
        },
      ]
    : [];
}

function buildShowLessRenderNode({
  isVisible,
}: {
  isVisible: boolean;
}): ShowLessTreeNode[] {
  return isVisible ? [{ id: "show-less", type: "show-less" }] : [];
}

/**
 * Builds the bounded list of real and synthetic child rows for one parent.
 * When a selected path falls beyond the limit, the selected child replaces the
 * last preview row instead of disabling truncation for the entire sibling list.
 *
 * @param params - Child rendering inputs.
 * @param params.childNodes - Chronologically ordered direct children.
 * @param params.childLimit - Maximum number of real child rows to preview.
 * @param params.selectedSpanPathNodeIds - Span ids on the selected branch.
 * @param params.shouldShowAllChildren - Whether truncation is disabled.
 * @param params.shouldShowLess - Whether to append the collapse action.
 */
function buildChildRenderNodes<TSpan extends ISpanItem>({
  childNodes,
  childLimit,
  selectedSpanPathNodeIds,
  shouldShowAllChildren,
  shouldShowLess,
}: {
  childNodes: SpanTreeNode<TSpan>[];
  childLimit: number;
  selectedSpanPathNodeIds: Set<string>;
  shouldShowAllChildren: boolean;
  shouldShowLess: boolean;
}): SpanTreeRenderNode<TSpan>[] {
  if (shouldShowAllChildren || childNodes.length <= childLimit) {
    return [
      ...buildSpanRenderNodes({ nodes: childNodes }),
      ...buildShowLessRenderNode({
        isVisible: shouldShowLess && childNodes.length > childLimit,
      }),
    ];
  }

  const selectedChildIndex = childNodes.findIndex((childNode) =>
    selectedSpanPathNodeIds.has(childNode.span.id)
  );
  const hasSelectedChild = selectedChildIndex >= 0;
  const isSelectedChildInPreview = selectedChildIndex < childLimit;
  if (!hasSelectedChild || isSelectedChildInPreview) {
    return [
      ...buildSpanRenderNodes({ nodes: childNodes.slice(0, childLimit) }),
      ...buildShowMoreRenderNode({
        id: "after-limit",
        nodes: childNodes.slice(childLimit),
      }),
    ];
  }

  const leadingChildCount = Math.max(childLimit - 1, 0);
  const selectedChild = childNodes[selectedChildIndex];
  if (!selectedChild) {
    return buildSpanRenderNodes({ nodes: childNodes.slice(0, childLimit) });
  }
  const remainingChildNodes = [
    ...childNodes.slice(leadingChildCount, selectedChildIndex),
    ...childNodes.slice(selectedChildIndex + 1),
  ];
  return [
    ...buildSpanRenderNodes({
      nodes: childNodes.slice(0, leadingChildCount),
    }),
    ...buildShowMoreRenderNode({
      id: "around-selected",
      nodes: remainingChildNodes,
    }),
    ...buildSpanRenderNodes({ nodes: [selectedChild] }),
  ];
}

interface SpanTreeItemProps<TSpan extends ISpanItem> {
  node: SpanTreeNode<TSpan>;
  isChildTruncationEnabled: boolean;
  selectedSpanNodeId: string;
  selectedSpanPathNodeIds: Set<string>;
  scrollSelectedSpanIntoView: boolean;
  overallTimeRange: TimeRange;
  onSpanClick?: (span: ISpanItem) => void;
  onSpanSelectionStart?: (span: ISpanItem) => void;
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
    isChildTruncationEnabled,
    selectedSpanNodeId,
    selectedSpanPathNodeIds,
    scrollSelectedSpanIntoView,
    onSpanClick,
    onSpanSelectionStart,
    nestingLevel = 0,
    overallTimeRange,
  } = props;
  const childNodes = node.children;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [areAllChildrenVisible, setAreAllChildrenVisible] = useState(false);
  const { isCollapsed: treeIsCollapsed, searchQuery } = useTraceTree();
  const hasChildren = childNodes.length > 0;
  const isSearching = searchQuery.length > 0;
  const effectiveIsCollapsed = isSearching ? false : isCollapsed;
  const childNestingLevel = nestingLevel + 1;
  const childLimit = getChildLimit({ childNestingLevel });
  const shouldShowAllChildren =
    !isChildTruncationEnabled || isSearching || areAllChildrenVisible;
  const shouldShowLess =
    isChildTruncationEnabled && areAllChildrenVisible && !isSearching;
  const childRenderNodes = buildChildRenderNodes({
    childNodes,
    childLimit,
    selectedSpanPathNodeIds,
    shouldShowAllChildren,
    shouldShowLess,
  });
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
        onClick={(event) => {
          if (onSpanClick) {
            onSpanSelectionStart?.(node.span);
            beginOptimisticSpanNavigation({
              onNavigate: () => onSpanClick(node.span),
              spanNodeId: node.span.id,
              trigger: event.currentTarget,
            });
          }
        }}
      >
        <SpanNodeWrap
          isSelected={selectedSpanNodeId === node.span.id}
          nestingLevel={nestingLevel}
          spanNodeId={node.span.id}
        >
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
      {childRenderNodes.length ? (
        <ul
          css={css`
            display: ${effectiveIsCollapsed ? "none" : "flex"};
            flex-direction: column;
          `}
        >
          {childRenderNodes.map((childRenderNode, index) => {
            // The last child does not need an edge connector, a line to connect the nodes
            // after to the parent node
            const nextSibling = childRenderNodes[index + 1];
            const statusCode =
              childRenderNode.type === "span"
                ? childRenderNode.node.span.statusCode
                : SHOW_MORE_NODE_STATUS_CODE;
            const nextSiblingStatusCode =
              nextSibling?.type === "span"
                ? nextSibling.node.span.statusCode
                : SHOW_MORE_NODE_STATUS_CODE;
            return (
              <li
                key={
                  childRenderNode.type === "span"
                    ? childRenderNode.node.span.spanId
                    : `${childRenderNode.type}-${node.span.spanId}-${childRenderNode.id}`
                }
                css={css`
                  position: relative;
                `}
              >
                {nextSibling ? (
                  <SpanTreeEdgeConnector
                    statusCode={nextSiblingStatusCode}
                    nestingLevel={nestingLevel}
                  />
                ) : null}
                <SpanTreeEdge
                  statusCode={statusCode}
                  nestingLevel={nestingLevel}
                />
                {childRenderNode.type === "span" ? (
                  <SpanTreeItem
                    node={childRenderNode.node}
                    isChildTruncationEnabled={isChildTruncationEnabled}
                    overallTimeRange={overallTimeRange}
                    onSpanClick={onSpanClick}
                    onSpanSelectionStart={onSpanSelectionStart}
                    selectedSpanNodeId={selectedSpanNodeId}
                    selectedSpanPathNodeIds={selectedSpanPathNodeIds}
                    scrollSelectedSpanIntoView={scrollSelectedSpanIntoView}
                    nestingLevel={childNestingLevel}
                  />
                ) : (
                  <TraceTreeDisclosureNode
                    nestingLevel={childNestingLevel}
                    label={
                      childRenderNode.type === "show-more"
                        ? "Show more"
                        : "Show less"
                    }
                    isExpanded={childRenderNode.type === "show-less"}
                    onClick={() =>
                      setAreAllChildrenVisible(
                        childRenderNode.type === "show-more"
                      )
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

const traceTreeDisclosureNodeCSS = css`
  position: relative;
  --expandable-content-overlay-background-color: var(
    --trace-tree-show-more-background-color,
    var(--global-background-color-default)
  );

  .trace-tree-disclosure-node__action {
    z-index: 2;
    justify-content: flex-start;
    box-sizing: border-box;
    height: var(--global-dimension-size-450);
  }

  .trace-tree-disclosure-node__action > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/**
 * Renders a tree disclosure action with standard geometry under the shared
 * Expand gradient treatment.
 *
 * @param props - Disclosure row props.
 * @param props.nestingLevel - Zero-based tree level used for row indentation.
 * @param props.label - Visible and accessible action text.
 * @param props.isExpanded - Whether the sibling list is fully expanded.
 * @param props.onClick - Changes the sibling list's expansion state.
 */
function TraceTreeDisclosureNode({
  nestingLevel,
  label,
  isExpanded,
  onClick,
}: {
  nestingLevel: number;
  label: string;
  isExpanded: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className="trace-tree-disclosure-node"
      css={traceTreeDisclosureNodeCSS}
    >
      <div aria-hidden="true">
        <SpanNodeWrap isSelected={false} nestingLevel={nestingLevel}>
          <Flex
            className="span-tree-name"
            direction="row"
            gap="size-100"
            justifyContent="start"
            alignItems="center"
            flex={`1 1 ${TRACE_TREE_NAME_MAX_WIDTH_PIXELS}px`}
            minWidth={0}
            maxWidth={`${TRACE_TREE_NAME_MAX_WIDTH_PIXELS}px`}
          >
            <SpanKindIcon spanKind="" />
            <span css={spanNameCSS} title="" />
          </Flex>
        </SpanNodeWrap>
      </div>
      <button
        type="button"
        className="expand-button button--reset trace-tree-disclosure-node__action"
        css={[
          expandableContentExpandButtonCSS,
          css`
            /* Begin at this node's elbow so ancestor connectors stay visible. */
            left: calc(
              (${nestingLevel} * var(--trace-tree-nesting-indent)) +
                var(--global-dimension-size-50)
            );
            width: auto;
            /* Align the label after the unknown-kind icon and row gap. */
            padding-left: calc(
              var(--global-dimension-size-200) +
                var(--global-dimension-size-250) +
                var(--global-dimension-size-100)
            );
          `,
        ]}
        aria-label={label}
        aria-expanded={isExpanded}
        onClick={onClick}
      >
        <span>{label}</span>
      </button>
    </div>
  );
}

function SpanNodeWrap(
  props: PropsWithChildren<{
    isSelected: boolean;
    nestingLevel: number;
    spanNodeId?: string;
  }>
) {
  return (
    <div
      data-selected={props.isSelected}
      data-trace-tree-span-node-id={props.spanNodeId}
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
          box-sizing: border-box;
          padding-left: calc(
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
  min-width: ${TRACE_TREE_TIMING_MIN_WIDTH_PIXELS}px;
  max-width: ${TRACE_TREE_TIMING_MAX_WIDTH_PIXELS}px;
  flex: 1 1 ${TRACE_TREE_TIMING_MIN_WIDTH_PIXELS}px;
  display: grid;
  grid-template-columns: ${TRACE_TREE_LATENCY_WIDTH_PIXELS}px minmax(0, 1fr);
  align-items: center;
  .latency-text {
    justify-content: end !important;
    width: 100%;
    min-width: 0;
    overflow: hidden;
  }
  .latency-text .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timeline-bar {
    grid-column: 2;
    width: 100%;
    min-width: 0;
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
