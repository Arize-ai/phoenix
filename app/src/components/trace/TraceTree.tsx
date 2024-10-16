import React, {
  PropsWithChildren,
  startTransition,
  useEffect,
  useState,
} from "react";
import { css } from "@emotion/react";

import {
  Button,
  classNames,
  Flex,
  Icon,
  Icons,
  Tooltip,
  TooltipTrigger,
  View,
} from "@arizeai/components";

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
    <View borderBottomWidth="thin" borderColor="dark" padding="size-100">
      <Flex direction="row" justifyContent="end" flex="none" gap="size-100">
        <TooltipTrigger offset={5}>
          <Button
            variant="default"
            size="compact"
            aria-label={isCollapsed ? "Expand all" : "Collapse all"}
            onClick={() => {
              setIsCollapsed(!isCollapsed);
            }}
            icon={
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
          <Tooltip>
            {isCollapsed
              ? "Expand all nested spans"
              : "Collapse all nested spans"}
          </Tooltip>
        </TooltipTrigger>
        <TooltipTrigger offset={5}>
          <Button
            variant="default"
            size="compact"
            aria-label={
              showMetricsInTraceTree
                ? "Hide metrics in trace tree"
                : "Show metrics in trace tree"
            }
            onClick={() => {
              setShowMetricsInTraceTree(!showMetricsInTraceTree);
            }}
            icon={
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
          <Tooltip>
            {showMetricsInTraceTree
              ? "Hide metrics in trace tree"
              : "Show metrics in trace tree"}
          </Tooltip>
        </TooltipTrigger>
      </Flex>
    </View>
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

function SpanTreeItem<TSpan extends ISpanItem>(props: {
  node: SpanTreeNode<TSpan>;
  selectedSpanNodeId: string;
  onSpanClick?: (span: ISpanItem) => void;
  /**
   * How deep the item is nested in the tree. Starts at 0.
   * @default 0
   */
  nestingLevel?: number;
}) {
  const { node, selectedSpanNodeId, onSpanClick, nestingLevel = 0 } = props;
  const childNodes = node.children;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isCollapsed: treeIsCollapsed } = useTraceTree();
  const hasChildren = childNodes.length > 0;
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );

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
    <div>
      <button
        className="button--reset"
        css={css`
          width: 100%;
          min-width: 200px;
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
              <SpanStatusCodeIcon statusCode="ERROR" />
            ) : null}
            {typeof tokenCountTotal === "number" && showMetricsInTraceTree ? (
              <TokenCount
                tokenCountTotal={tokenCountTotal}
                tokenCountPrompt={tokenCountPrompt ?? 0}
                tokenCountCompletion={tokenCountCompletion ?? 0}
              />
            ) : null}
            {latencyMs != null && showMetricsInTraceTree ? (
              <LatencyText latencyMs={latencyMs} showIcon={false} />
            ) : null}
          </Flex>
          <div css={spanControlsCSS} data-testid="span-controls">
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
                key={leafNode.span.context.spanId}
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
      className={props.isSelected ? "is-selected" : ""}
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
          background-color: var(--ac-global-color-primary-300);
          border-color: var(--ac-global-color-primary);
        }
        & > *:first-child {
          margin-left: ${props.nestingLevel * NESTING_INDENT + 16}px;
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
  return (
    <div
      aria-hidden="true"
      data-testid="span-tree-edge-connector"
      css={(theme) => css`
        position: absolute;
        border-left: 1px solid
          ${statusCode === "ERROR"
            ? theme.colors.statusDanger
            : "var(--ac-global-color-grey-700)"};
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
  return (
    <div
      aria-hidden="true"
      css={(theme) => {
        const color =
          statusCode === "ERROR"
            ? theme.colors.statusDanger
            : "var(--ac-global-color-grey-700)";
        return css`
          position: absolute;
          border-left: 1px solid ${color};
          border-bottom: 1px solid ${color};
          border-radius: 0 0 0 11px;
          top: -5px;
          left: ${nestingLevel * NESTING_INDENT + 29}px;
          width: 15px;
          height: 24px;
        `;
      }}
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
      className={classNames("button--reset", {
        "is-collapsed": isCollapsed,
      })}
      css={collapseButtonCSS}
    >
      <Icon svg={<Icons.ArrowIosDownwardOutline />} />
    </button>
  );
}
