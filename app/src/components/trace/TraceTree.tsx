import {
  PropsWithChildren,
  startTransition,
  useEffect,
  useRef,
  useState,
} from "react";
import { css } from "@emotion/react";

import {
  classNames,
  Tooltip,
  TooltipTrigger,
  TriggerWrap,
} from "@arizeai/components";

import { Button, Flex, Heading, Icon, Icons } from "@phoenix/components";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { LatencyText } from "./LatencyText";
import { SpanKindIcon } from "./SpanKindIcon";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import { TraceTreeProvider, useTraceTree } from "./TraceTreeContext";
import { ISpanItem, SpanStatusCodeType } from "./types";
import { createSpanTree, SpanTreeNode } from "./utils";

type TraceTreeProps = {
  spans: ISpanItem[];
  onSpanClick?: (span: ISpanItem) => void;
  selectedSpanNodeId: string;
};

/**
 * The amount of padding to add to the left of the span item for each level of nesting.
 */
const NESTING_INDENT = 30;

/**
 * The breakpoint at which the trace tree switches to compact mode.
 */
const COMPACT_BREAKPOINT = "200px";

export function TraceTree(props: TraceTreeProps) {
  const { spans, onSpanClick, selectedSpanNodeId } = props;
  const spanTree = createSpanTree(spans);
  return (
    <TraceTreeProvider>
      <div
        css={css`
          display: flex;
          flex-direction: column;
          overflow: hidden;
          height: 100%;
          align-items: stretch;
          container-type: inline-size;
        `}
      >
        <TraceTreeToolbar />
        <ul
          css={css`
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            width: 100%;
            overflow: auto;
            --trace-tree-nesting-indent: ${NESTING_INDENT}px;
            @container (width < ${COMPACT_BREAKPOINT}) {
              --trace-tree-nesting-indent: 0;
              // Hide the collapse button
              .span-controls,
              .latency-text,
              .token-count-item,
              .span-tree-edge-connector,
              .span-tree-edge {
                display: none;
                visibility: hidden;
                width: 0;
              }
              .span-node-wrap {
                padding-left: var(--ac-global-dimension-static-size-200);
              }
            }
          `}
          data-testid="trace-tree"
        >
          {spanTree.map((spanNode) => (
            <SpanTreeItem
              key={spanNode.span.id}
              node={spanNode}
              onSpanClick={onSpanClick}
              selectedSpanNodeId={selectedSpanNodeId}
            />
          ))}
        </ul>
      </div>
    </TraceTreeProvider>
  );
}

function TraceTreeToolbar() {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const setShowMetricsInTraceTree = usePreferencesContext(
    (state) => state.setShowMetricsInTraceTree
  );
  const { isCollapsed, setIsCollapsed } = useTraceTree();
  return (
    <div
      className="trace-tree-toolbar"
      css={css`
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        box-sizing: border-box;
        width: 100%;
        align-items: center;
        padding: var(--ac-global-dimension-size-100);
        border-bottom: 1px solid var(--ac-global-color-grey-300);
        height: var(--ac-global-dimension-size-600);
        @container (width < ${COMPACT_BREAKPOINT}) {
          button {
            display: none;
          }
        }
      `}
    >
      <Flex
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        flex="none"
        gap="size-100"
        width="100%"
      >
        <Heading level={3}>Trace</Heading>
        <Flex direction="row" gap="size-100" className="trace-tree-controls">
          <TooltipTrigger offset={5}>
            <TriggerWrap>
              <Button
                variant="default"
                size="S"
                aria-label={isCollapsed ? "Expand all" : "Collapse all"}
                onPress={() => {
                  setIsCollapsed(!isCollapsed);
                }}
                leadingVisual={
                  <Icon
                    svg={
                      isCollapsed ? (
                        <Icons.RowCollapseOutline />
                      ) : (
                        <Icons.RowExpandOutline />
                      )
                    }
                  />
                }
              />
            </TriggerWrap>
            <Tooltip>
              {isCollapsed
                ? "Expand all nested spans"
                : "Collapse all nested spans"}
            </Tooltip>
          </TooltipTrigger>
          <TooltipTrigger offset={5}>
            <TriggerWrap>
              <Button
                size="S"
                aria-label={
                  showMetricsInTraceTree
                    ? "Hide metrics in trace tree"
                    : "Show metrics in trace tree"
                }
                onPress={() => {
                  setShowMetricsInTraceTree(!showMetricsInTraceTree);
                }}
                leadingVisual={
                  <Icon
                    svg={
                      showMetricsInTraceTree ? (
                        <Icons.TimerOutline />
                      ) : (
                        <Icons.TimerOffOutline />
                      )
                    }
                  />
                }
              />
            </TriggerWrap>
            <Tooltip>
              {showMetricsInTraceTree
                ? "Hide metrics in trace tree"
                : "Show metrics in trace tree"}
            </Tooltip>
          </TooltipTrigger>
        </Flex>
      </Flex>
    </div>
  );
}

const spanNameCSS = css`
  font-weight: 500;
  color: var(--ac-global-text-color-900);
  display: inline-block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface SpanTreeItemProps<TSpan extends ISpanItem> {
  node: SpanTreeNode<TSpan>;
  selectedSpanNodeId: string;
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
  const { node, selectedSpanNodeId, onSpanClick, nestingLevel = 0 } = props;
  const childNodes = node.children;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCollapsed: treeIsCollapsed } = useTraceTree();
  const hasChildren = childNodes.length > 0;
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  const isSelected = selectedSpanNodeId === node.span.id;
  const itemRef = useRef<HTMLDivElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [isSelected]);

  // React to global changes to the trace tree state and change local state
  useEffect(() => {
    setIsCollapsed(treeIsCollapsed);
  }, [treeIsCollapsed]);

  const {
    name,
    latencyMs,
    statusCode,
    tokenCountTotal,
    tokenCountPrompt,
    tokenCountCompletion,
  } = node.span;
  return (
    <div ref={itemRef}>
      <button
        className="button--reset"
        css={css`
          width: 100%;
          overflow: hidden;
          cursor: pointer;
        `}
        onClick={() => {
          startTransition(() => {
            onSpanClick && onSpanClick(node.span);
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
          >
            <SpanKindIcon spanKind={node.span.spanKind} />
            <span css={spanNameCSS} title={name}>
              {name}
            </span>
            {statusCode === "ERROR" ? (
              <SpanStatusCodeIcon
                statusCode="ERROR"
                css={css`
                  font-size: var(--ac-global-font-size-m);
                `}
              />
            ) : null}
            {typeof tokenCountTotal === "number" &&
            tokenCountTotal > 0 &&
            showMetricsInTraceTree ? (
              <TokenCount
                tokenCountTotal={tokenCountTotal}
                tokenCountPrompt={tokenCountPrompt ?? 0}
                tokenCountCompletion={tokenCountCompletion ?? 0}
              />
            ) : null}
            {latencyMs != null && showMetricsInTraceTree ? (
              <LatencyText latencyMs={latencyMs} showIcon={false} size="XS" />
            ) : null}
          </Flex>
          <div
            css={spanControlsCSS}
            data-testid="span-controls"
            className="span-controls"
          >
            {hasChildren ? (
              <CollapseToggleButton
                isCollapsed={isCollapsed}
                onClick={() => {
                  setIsCollapsed(!isCollapsed);
                }}
              />
            ) : null}
          </div>
        </SpanNodeWrap>
      </button>
      {childNodes.length ? (
        <ul
          css={css`
            display: ${isCollapsed ? "none" : "flex"};
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
                  onSpanClick={onSpanClick}
                  selectedSpanNodeId={selectedSpanNodeId}
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
        gap: var(--ac-global-dimension-static-size-100);
        padding-right: var(--ac-global-dimension-static-size-100);
        padding-top: var(--ac-global-dimension-static-size-100);
        padding-bottom: var(--ac-global-dimension-static-size-100);
        border-left: 4px solid transparent;
        box-sizing: border-box;
        &:hover {
          background-color: var(--ac-global-color-grey-200);
        }
        &.is-selected {
          background-color: var(--ac-global-color-primary-100);
          border-color: var(--ac-global-color-primary-200);
        }
        & > *:first-child {
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
            ? "var(--ac-global-color-danger)"
            : "var(--ac-global-color-grey-700)"};
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
    ? "var(--ac-global-color-danger)"
    : "var(--ac-global-color-grey-700)";
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
        width: 15px;
        height: 24px;
      `}
    ></div>
  );
}

const spanControlsCSS = css`
  width: 20px;
  flex: none;
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
  color: var(--ac-global-text-color-900);
  border-radius: 4px;
  transition: transform 0.2s;
  transition: background-color 0.5s;
  flex: none;
  background-color: rgba(0, 0, 0, 0.1);
  &:hover {
    background-color: rgba(0, 0, 0, 0.3);
  }
  &.is-collapsed {
    transform: rotate(-90deg);
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
      className={classNames("button--reset collapse-toggle-button", {
        "is-collapsed": isCollapsed,
      })}
      css={collapseButtonCSS}
    >
      <Icon svg={<Icons.ArrowIosDownwardOutline />} />
    </button>
  );
}
