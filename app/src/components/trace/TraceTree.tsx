import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
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
import { popoverSurfaceCSS } from "@phoenix/components/core/overlay/styles";
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
import { TraceErrorCount } from "./TraceErrorCount";
import { useTraceTree } from "./TraceTreeContext";
import {
  TRACE_TREE_CHILD_NESTING_INDENT_PIXELS,
  TRACE_TREE_ROW_SELECTION_BORDER_WIDTH,
  traceTreeListCSS,
} from "./traceTreeStyles";
import type { ISpanItem, SpanStatusCodeType } from "./types";
import type { SpanTreeNode } from "./utils";
import { createSpanTree, filterSpanTree } from "./utils";

export type TraceTreeProps = {
  spans: ISpanItem[];
  /** Whether to render an icon rail with a separate full-tree hover overlay. */
  isNavigationCollapsed?: boolean;
  /**
   * Whether this tree owns the hover overlay while navigation is collapsed.
   * Disable this when an ancestor already owns compact-navigation hover.
   * @default true
   */
  isHoverOverlayEnabled?: boolean;
  /**
   * Whether large child lists use Show more and Show less disclosure rows.
   * @default false
   */
  isChildTruncationEnabled?: boolean;
  session?: {
    actions?: ReactNode;
    sessionId: string;
    to: To;
  };
  traceSelection?: {
    actions?: ReactNode;
    isSelected: boolean;
    onSelect: () => void;
    traceId: string;
  };
  onSpanClick?: (span: ISpanItem) => void;
  onSpanSelectionStart?: (span: ISpanItem) => void;
  renderSpanActions?: (span: ISpanItem) => ReactNode;
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
  const tree = trigger.closest("[data-trace-tree-root]");
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
  const targetSelector = `[data-trace-tree-span-node-id="${CSS.escape(spanNodeId)}"]`;
  const targetNode = trigger.matches(targetSelector)
    ? trigger
    : trigger.querySelector<HTMLElement>(targetSelector);
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

function flattenSpanTreeNodes<TSpan>({
  nodes,
}: {
  nodes: SpanTreeNode<TSpan>[];
}): SpanTreeNode<TSpan>[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenSpanTreeNodes({ nodes: node.children }),
  ]);
}

const traceTreeNavigationCSS = css`
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: visible;
  align-items: stretch;

  &.trace-tree-navigation--collapsed {
    overflow: hidden;
  }

  &:has(.trace-tree-navigation__overlay[data-open="true"]) {
    overflow: visible;
  }
`;

const traceTreeFullCSS = css`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  align-items: stretch;
  container-type: inline-size;
`;

const traceTreeOverlayCSS = css`
  flex: 0 0 auto;
  width: var(--trace-tree-overlay-width);
  min-width: var(--trace-tree-overlay-width);
  height: fit-content;
  max-height: 100%;
  visibility: hidden;
  pointer-events: none;

  &[data-open="true"] {
    ${popoverSurfaceCSS}
    position: absolute;
    top: 0;
    left: 0;
    z-index: var(--global-z-index-local-overlay);
    padding-bottom: var(--global-dimension-size-100);
    border-color: var(--global-border-color-default);
    border-radius: var(--global-rounding-small);
    visibility: visible;
    pointer-events: auto;
  }
`;

const traceTreeIconRailCSS = css`
  position: absolute;
  inset: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border: var(--global-border-size-thin) solid transparent;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  list-style: none;

  &::-webkit-scrollbar {
    width: 0;
    height: 0;
  }

  &[aria-hidden="true"] {
    visibility: hidden;
    pointer-events: none;
  }

  .trace-tree-icon-rail__item {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: var(--global-details-panel-navigation-row-height);
    padding: 0 0 0
      var(--global-details-panel-navigation-row-content-padding-inline-start);
    border: 0;
    border-left: ${TRACE_TREE_ROW_SELECTION_BORDER_WIDTH} solid transparent;
    background: transparent;
    color: var(--global-text-color-700);
    cursor: pointer;
    text-decoration: none;
  }

  .trace-tree-icon-rail__item:hover {
    background-color: var(--global-list-item-hover-background-color);
  }

  .trace-tree-icon-rail__item[data-selected="true"] {
    border-left-color: var(--global-color-gray-300);
    background-color: rgba(var(--global-color-gray-200-rgb), 0.5);
  }

  .trace-tree-icon-rail__item[data-selected="true"][data-status-code="ERROR"] {
    border-left-color: var(--global-color-danger);
  }

  .trace-tree-icon-rail__item:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }
`;

export function TraceTree(props: TraceTreeProps) {
  const {
    spans,
    isNavigationCollapsed = false,
    isHoverOverlayEnabled = true,
    isChildTruncationEnabled = false,
    session,
    traceSelection,
    onSpanClick,
    onSpanSelectionStart,
    renderSpanActions,
    selectedSpanNodeId,
    scrollSelectedSpanIntoView = true,
  } = props;
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const fullTreeScrollRef = useRef<HTMLUListElement>(null);
  const iconRailScrollRef = useRef<HTMLUListElement>(null);
  const [collapsedSpanNodeIds, setCollapsedSpanNodeIds] = useState<Set<string>>(
    () => new Set()
  );
  const [
    fullyVisibleChildListSpanNodeIds,
    setFullyVisibleChildListSpanNodeIds,
  ] = useState<Set<string>>(() => new Set());
  const {
    errorCount,
    hasErrors,
    isCollapsed: isTreeCollapsed,
    searchQuery,
  } = useTraceTree();
  const spanTree = createSpanTree(spans);
  const filteredSpanTree = filterSpanTree(spanTree, searchQuery);
  const selectedSpanPathNodeIds = getSelectedSpanPathNodeIds({
    spans,
    selectedSpanNodeId,
  });
  const rootSpan = spanTree[0]?.span;
  const hasSearchQuery = searchQuery.length > 0;
  const noSearchResults = hasSearchQuery && filteredSpanTree.length === 0;
  const visibleCompactSpanNodes = flattenVisibleSpanTreeNodes({
    nodes: filteredSpanTree,
    collapsedSpanNodeIds,
    fullyVisibleChildListSpanNodeIds,
    isChildTruncationEnabled,
    isSearching: hasSearchQuery,
    selectedSpanPathNodeIds,
  });
  const overallTimeRange = {
    start: rootSpan ? new Date(rootSpan.startTime) : new Date(),
    end: rootSpan?.endTime ? new Date(rootSpan.endTime) : new Date(),
  };
  const synchronizeGlobalCollapse = useEffectEvent((isCollapsed: boolean) => {
    setCollapsedSpanNodeIds(
      isCollapsed
        ? new Set(
            flattenSpanTreeNodes({ nodes: spanTree })
              .filter((node) => node.children.length > 0)
              .map((node) => node.span.id)
          )
        : new Set()
    );
  });
  useEffect(() => {
    synchronizeGlobalCollapse(isTreeCollapsed);
  }, [isTreeCollapsed]);

  const handleSpanCollapsedChange = ({
    isCollapsed,
    spanNodeId,
  }: {
    isCollapsed: boolean;
    spanNodeId: string;
  }) => {
    setCollapsedSpanNodeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (isCollapsed) {
        nextIds.add(spanNodeId);
      } else {
        nextIds.delete(spanNodeId);
      }
      return nextIds;
    });
  };

  const handleAllChildrenVisibleChange = ({
    areAllChildrenVisible,
    spanNodeId,
  }: {
    areAllChildrenVisible: boolean;
    spanNodeId: string;
  }) => {
    setFullyVisibleChildListSpanNodeIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (areAllChildrenVisible) {
        nextIds.add(spanNodeId);
      } else {
        nextIds.delete(spanNodeId);
      }
      return nextIds;
    });
  };

  const canOpenHoverOverlay = isNavigationCollapsed && isHoverOverlayEnabled;
  const isHoverOverlayOpen = canOpenHoverOverlay && isOverlayOpen;
  const handleOverlayPointerEnter = () => {
    const fullTreeScroll = fullTreeScrollRef.current;
    const iconRailScroll = iconRailScrollRef.current;
    if (fullTreeScroll && iconRailScroll) {
      fullTreeScroll.scrollTop = iconRailScroll.scrollTop;
    }
    setIsOverlayOpen(true);
  };
  const handleOverlayPointerLeave = () => {
    const fullTreeScroll = fullTreeScrollRef.current;
    const iconRailScroll = iconRailScrollRef.current;
    if (fullTreeScroll && iconRailScroll) {
      iconRailScroll.scrollTop = fullTreeScroll.scrollTop;
    }
    setIsOverlayOpen(false);
  };
  const fullTree = (
    <div
      className={classNames("trace-tree-navigation__full", {
        "trace-tree-navigation__overlay": isNavigationCollapsed,
      })}
      data-open={isNavigationCollapsed ? isHoverOverlayOpen : undefined}
      aria-hidden={isNavigationCollapsed ? !isHoverOverlayOpen : undefined}
      inert={isNavigationCollapsed && !isHoverOverlayOpen ? true : undefined}
      css={[traceTreeFullCSS, isNavigationCollapsed && traceTreeOverlayCSS]}
    >
      <ul
        ref={fullTreeScrollRef}
        css={[
          traceTreeListCSS,
          css`
            overflow-x: auto;
            overflow-y: var(--trace-tree-overflow-y, auto);
          `,
        ]}
        data-trace-tree-root
        data-testid="trace-tree"
      >
        {session ? (
          <li>
            <SessionTreeItem {...session} />
          </li>
        ) : null}
        {traceSelection ? (
          <li>
            <TraceTreeItem {...traceSelection} errorCount={errorCount} />
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
            renderSpanActions={renderSpanActions}
            selectedSpanNodeId={selectedSpanNodeId}
            selectedSpanPathNodeIds={selectedSpanPathNodeIds}
            collapsedSpanNodeIds={collapsedSpanNodeIds}
            fullyVisibleChildListSpanNodeIds={fullyVisibleChildListSpanNodeIds}
            onAllChildrenVisibleChange={handleAllChildrenVisibleChange}
            onCollapsedChange={handleSpanCollapsedChange}
            scrollSelectedSpanIntoView={scrollSelectedSpanIntoView}
            isChildTruncationEnabled={isChildTruncationEnabled}
          />
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className={classNames("trace-tree-navigation", {
        "trace-tree-navigation--collapsed": isNavigationCollapsed,
      })}
      data-navigation-scrollbar={
        !isNavigationCollapsed || isHoverOverlayOpen ? "active" : undefined
      }
      css={traceTreeNavigationCSS}
      onPointerEnter={
        canOpenHoverOverlay ? handleOverlayPointerEnter : undefined
      }
      onPointerLeave={
        canOpenHoverOverlay ? handleOverlayPointerLeave : undefined
      }
    >
      {fullTree}
      {isNavigationCollapsed ? (
        <ul
          ref={iconRailScrollRef}
          aria-label="Trace navigation"
          aria-hidden={isHoverOverlayOpen || undefined}
          inert={isHoverOverlayOpen || undefined}
          className="trace-tree-icon-rail"
          css={traceTreeIconRailCSS}
          data-trace-tree-root
          data-testid="trace-tree-icon-rail"
        >
          {session ? (
            <li>
              <Link
                className="trace-tree-icon-rail__item"
                to={session.to}
                aria-label={`View session ${session.sessionId}`}
              >
                <Icon aria-hidden="true" svg={<Icons.MessagesSquare />} />
              </Link>
            </li>
          ) : null}
          {traceSelection ? (
            <li>
              <button
                type="button"
                className="trace-tree-icon-rail__item"
                data-selected={traceSelection.isSelected}
                aria-label={
                  hasErrors
                    ? `View trace ${traceSelection.traceId}, ${errorCount} ${errorCount === 1 ? "error" : "errors"}`
                    : `View trace ${traceSelection.traceId}`
                }
                aria-pressed={traceSelection.isSelected}
                onClick={traceSelection.onSelect}
              >
                <Icon aria-hidden="true" svg={<Icons.Trace />} />
              </button>
            </li>
          ) : null}
          {visibleCompactSpanNodes.map(({ span }) => {
            const isSelected = selectedSpanNodeId === span.id;
            return (
              <li key={span.id}>
                <button
                  type="button"
                  className="trace-tree-icon-rail__item"
                  data-selected={isSelected}
                  data-status-code={span.statusCode}
                  data-trace-tree-span-node-id={span.id}
                  aria-label={`View span ${span.name}`}
                  aria-pressed={isSelected}
                  onClick={(event) => {
                    if (!onSpanClick) return;
                    onSpanSelectionStart?.(span);
                    beginOptimisticSpanNavigation({
                      onNavigate: () => onSpanClick(span),
                      spanNodeId: span.id,
                      trigger: event.currentTarget,
                    });
                  }}
                >
                  <SpanKindIcon spanKind={span.spanKind} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

const entityTreeItemCSS = css`
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--global-details-panel-navigation-row-height);
  gap: var(--global-dimension-size-100);
  padding: 0 var(--global-dimension-size-100);
  padding-left: var(
    --global-details-panel-navigation-row-content-padding-inline-start
  );
  border-left: ${TRACE_TREE_ROW_SELECTION_BORDER_WIDTH} solid transparent;
  overflow: hidden;

  &:hover {
    background-color: var(--global-list-item-hover-background-color);
  }

  &[data-selected="true"] {
    background-color: rgba(var(--global-color-gray-200-rgb), 0.5);
    border-left-color: var(--global-color-gray-300);
  }

  .trace-tree-entity-item__label {
    color: var(--trace-tree-row-text-color-rest);
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
    flex: 1 1 120px;
    justify-content: flex-end;
    max-width: 120px;
    margin-left: auto;
    min-width: 0;
    overflow: hidden;
  }

  .trace-tree-entity-item__actions {
    position: relative;
    z-index: 1;
    display: flex;
    flex: none;
    align-items: center;
    opacity: 0;
    pointer-events: none;
  }

  &:hover .trace-tree-entity-item__actions,
  &:focus-within .trace-tree-entity-item__actions {
    opacity: 1;
    pointer-events: auto;
  }

  .trace-tree-entity-item__id > button {
    width: 100%;
    max-width: 100%;
    justify-content: flex-end;
    margin-right: 0;
    overflow: hidden;
  }

  .icon-wrap {
    flex: none;
    color: var(--global-text-color-700);
  }
`;

function SessionTreeItem({
  actions,
  sessionId,
  to,
}: {
  actions?: ReactNode;
  sessionId: string;
  to: To;
}) {
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
        <CopyableIDBadge
          id={sessionId}
          overflowMode="truncate"
          tooltipText="Copy Session ID"
        />
      </div>
      {actions ? (
        <div className="trace-tree-entity-item__actions">{actions}</div>
      ) : null}
    </div>
  );
}

function TraceTreeItem({
  actions,
  errorCount,
  isSelected,
  onSelect,
  traceId,
}: {
  actions?: ReactNode;
  errorCount: number;
  isSelected: boolean;
  onSelect: () => void;
  traceId: string;
}) {
  const hasErrors = errorCount > 0;
  return (
    <div css={entityTreeItemCSS} data-selected={isSelected}>
      <button
        type="button"
        className="trace-tree-entity-item__action"
        aria-label={
          hasErrors
            ? `View trace ${traceId}, ${errorCount} ${errorCount === 1 ? "error" : "errors"}`
            : `View trace ${traceId}`
        }
        aria-pressed={isSelected}
        onClick={onSelect}
      />
      <Icon aria-hidden="true" svg={<Icons.Trace />} />
      <Text className="trace-tree-entity-item__label" size="S">
        Trace
      </Text>
      <TraceErrorCount errorCount={errorCount} />
      <div className="trace-tree-entity-item__id">
        <CopyableIDBadge
          id={traceId}
          overflowMode="truncate"
          tooltipText="Copy Trace ID"
        />
      </div>
      {actions ? (
        <div className="trace-tree-entity-item__actions">{actions}</div>
      ) : null}
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
  color: var(--trace-tree-row-text-color-rest);
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

/**
 * Projects the full tree's current disclosure and truncation state into the
 * compact icon rail. Synthetic Show more/less rows are actions rather than
 * spans, so they are intentionally omitted from the compact projection.
 */
function flattenVisibleSpanTreeNodes<TSpan extends ISpanItem>({
  nodes,
  collapsedSpanNodeIds,
  fullyVisibleChildListSpanNodeIds,
  isChildTruncationEnabled,
  isSearching,
  selectedSpanPathNodeIds,
  nestingLevel = 0,
}: {
  nodes: SpanTreeNode<TSpan>[];
  collapsedSpanNodeIds: Set<string>;
  fullyVisibleChildListSpanNodeIds: Set<string>;
  isChildTruncationEnabled: boolean;
  isSearching: boolean;
  selectedSpanPathNodeIds: Set<string>;
  nestingLevel?: number;
}): SpanTreeNode<TSpan>[] {
  return nodes.flatMap((node) => {
    const isCollapsed = !isSearching && collapsedSpanNodeIds.has(node.span.id);
    if (isCollapsed) {
      return [node];
    }

    const childNestingLevel = nestingLevel + 1;
    const areAllChildrenVisible = fullyVisibleChildListSpanNodeIds.has(
      node.span.id
    );
    const childRenderNodes = buildChildRenderNodes({
      childNodes: node.children,
      childLimit: getChildLimit({ childNestingLevel }),
      selectedSpanPathNodeIds,
      shouldShowAllChildren:
        !isChildTruncationEnabled || isSearching || areAllChildrenVisible,
      shouldShowLess:
        isChildTruncationEnabled && areAllChildrenVisible && !isSearching,
    });
    const visibleChildNodes = childRenderNodes.flatMap((childRenderNode) =>
      childRenderNode.type === "span" ? [childRenderNode.node] : []
    );

    return [
      node,
      ...flattenVisibleSpanTreeNodes({
        nodes: visibleChildNodes,
        collapsedSpanNodeIds,
        fullyVisibleChildListSpanNodeIds,
        isChildTruncationEnabled,
        isSearching,
        selectedSpanPathNodeIds,
        nestingLevel: childNestingLevel,
      }),
    ];
  });
}

interface SpanTreeItemProps<TSpan extends ISpanItem> {
  node: SpanTreeNode<TSpan>;
  collapsedSpanNodeIds: Set<string>;
  fullyVisibleChildListSpanNodeIds: Set<string>;
  isChildTruncationEnabled: boolean;
  selectedSpanNodeId: string;
  selectedSpanPathNodeIds: Set<string>;
  scrollSelectedSpanIntoView: boolean;
  overallTimeRange: TimeRange;
  onSpanClick?: (span: ISpanItem) => void;
  onSpanSelectionStart?: (span: ISpanItem) => void;
  renderSpanActions?: (span: ISpanItem) => ReactNode;
  onAllChildrenVisibleChange: (options: {
    areAllChildrenVisible: boolean;
    spanNodeId: string;
  }) => void;
  onCollapsedChange: (options: {
    isCollapsed: boolean;
    spanNodeId: string;
  }) => void;
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
    collapsedSpanNodeIds,
    fullyVisibleChildListSpanNodeIds,
    isChildTruncationEnabled,
    selectedSpanNodeId,
    selectedSpanPathNodeIds,
    scrollSelectedSpanIntoView,
    onSpanClick,
    onSpanSelectionStart,
    renderSpanActions,
    onAllChildrenVisibleChange,
    onCollapsedChange,
    nestingLevel = 0,
    overallTimeRange,
  } = props;
  const childNodes = node.children;
  const { searchQuery } = useTraceTree();
  const isCollapsed = collapsedSpanNodeIds.has(node.span.id);
  const areAllChildrenVisible = fullyVisibleChildListSpanNodeIds.has(
    node.span.id
  );
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
          statusCode={statusCode}
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
            <span
              className="span-tree-name__label"
              css={spanNameCSS}
              title={name}
            >
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
            <span className="span-controls__collapse-toggle">
              {hasChildren && !isSearching ? (
                <CollapseToggleButton
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    onCollapsedChange({
                      isCollapsed: !isCollapsed,
                      spanNodeId: node.span.id,
                    });
                  }}
                />
              ) : null}
            </span>
            {renderSpanActions ? (
              <span
                className="span-controls__actions"
                onClick={(event) => event.stopPropagation()}
              >
                {renderSpanActions(node.span)}
              </span>
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
                    collapsedSpanNodeIds={collapsedSpanNodeIds}
                    fullyVisibleChildListSpanNodeIds={
                      fullyVisibleChildListSpanNodeIds
                    }
                    isChildTruncationEnabled={isChildTruncationEnabled}
                    overallTimeRange={overallTimeRange}
                    onSpanClick={onSpanClick}
                    onSpanSelectionStart={onSpanSelectionStart}
                    renderSpanActions={renderSpanActions}
                    onAllChildrenVisibleChange={onAllChildrenVisibleChange}
                    onCollapsedChange={onCollapsedChange}
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
                    onClick={() => {
                      onAllChildrenVisibleChange({
                        areAllChildrenVisible:
                          childRenderNode.type === "show-more",
                        spanNodeId: node.span.id,
                      });
                    }}
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
    height: var(--global-details-panel-navigation-row-height);
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
              (${nestingLevel} * var(--trace-tree-child-nesting-indent)) +
                var(--global-dimension-size-50)
            );
            width: auto;
            /* Align the label after the unknown-kind icon and row gap. */
            padding-left: calc(
              var(
                  --global-details-panel-navigation-row-content-padding-inline-start
                ) +
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
    statusCode?: SpanStatusCodeType;
  }>
) {
  return (
    <div
      data-selected={props.isSelected}
      data-status-code={props.statusCode}
      data-trace-tree-span-node-id={props.spanNodeId}
      className={classNames("span-node-wrap", {
        "is-selected": props.isSelected,
      })}
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
        &:hover {
          background-color: var(--global-list-item-hover-background-color);
        }
        &.is-selected {
          // Keep the fill translucent so the latency bar remains visible
          background-color: rgba(var(--global-color-gray-200-rgb), 0.5);
          border-color: var(--global-color-gray-300);
        }
        &.is-selected[data-status-code="ERROR"] {
          border-left-color: var(--global-color-danger);
        }
        .span-controls__actions {
          opacity: 0;
          pointer-events: none;
        }
        &:hover .span-controls__actions,
        &:focus-within .span-controls__actions {
          opacity: 1;
          pointer-events: auto;
        }
        &[data-status-code="ERROR"] .span-tree-name__label {
          color: var(--trace-tree-row-text-color-error);
        }
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
    ></div>
  );
}

const spanControlsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--global-dimension-size-50);
  flex: none;

  .span-controls__collapse-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex: none;
  }

  .span-controls__actions {
    display: flex;
    align-items: center;
  }
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
    white-space: nowrap;
  }
  .latency-text .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .theme--light & .latency-text .text {
    color: var(--global-text-color-700);
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
