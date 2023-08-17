import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Flex } from "@arizeai/components";

import { SpanItem } from "./SpanItem";

interface SpanItem {
  name: string;
  spanKind: string;
  latencyMs: number;
  startTime: string;
  parentId: string | null;
  context: {
    spanId: string;
  };
}

/**
 * An item in the tree of spans
 */
type SpanTreeNode = {
  span: SpanItem;
  children: SpanTreeNode[];
};
/**
 * A tree of spans starting at the root span
 */
type SpanTree = SpanTreeNode[];

/**
 * Create a span tree from a list of spans
 * @param spans
 */
function createSpanTree(spans: SpanItem[]): SpanTree {
  // A map of spanId to span tree node
  const spanMap = spans.reduce((acc, span) => {
    acc.set(span.context.spanId, {
      span,
      children: [],
    });
    return acc;
  }, new Map<string, SpanTreeNode>());
  const rootSpans: SpanTreeNode[] = [];
  for (const span of spans) {
    const spanTreeItem = spanMap.get(span.context.spanId);
    if (span.parentId === null) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      rootSpans.push(spanTreeItem!);
    } else {
      const parentSpanNode = spanMap.get(span.parentId);
      if (parentSpanNode) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        parentSpanNode.children.push(spanTreeItem!);
      }
    }
  }
  // We must sort the children of each span by their start time
  // So that the children are in the correct order
  for (const spanNode of spanMap.values()) {
    spanNode.children.sort(
      (a, b) =>
        new Date(a.span.startTime).valueOf() -
        new Date(b.span.startTime).valueOf()
    );
  }
  return rootSpans;
}

type TraceTreeProps = {
  spans: SpanItem[];
  onSpanClick?: (spanId: string) => void;
  selectedSpanId: string;
};

export function TraceTree(props: TraceTreeProps) {
  const { spans, onSpanClick, selectedSpanId } = props;
  const spanTree = createSpanTree(spans);
  return (
    <ul
      css={(theme) => css`
        margin: ${theme.spacing.margin16}px;
        display: flex;
        flex-direction: column;
        gap: ${theme.spacing.padding8}px;
      `}
    >
      {spanTree.map((spanNode) => (
        <SpanTreeItem
          key={spanNode.span.context.spanId}
          node={spanNode}
          onSpanClick={onSpanClick}
          selectedSpanId={selectedSpanId}
        />
      ))}
    </ul>
  );
}

function SpanTreeItem(props: {
  node: SpanTreeNode;
  selectedSpanId: string;
  onSpanClick?: (spanId: string) => void;
}) {
  const { node, selectedSpanId, onSpanClick } = props;
  const childNodes = node.children;
  return (
    <div>
      <button
        className="button--reset"
        css={css`
          min-width: var(--ac-global-dimension-static-size-5000);
        `}
        onClick={() => {
          onSpanClick && onSpanClick(node.span.context.spanId);
        }}
      >
        <SpanNodeWrap isSelected={selectedSpanId === node.span.context.spanId}>
          <Flex
            direction="row"
            gap="size-100"
            justifyContent="start"
            alignItems="center"
          >
            <SpanNodeIcon />
            <SpanItem {...node.span} />
          </Flex>
        </SpanNodeWrap>
      </button>
      {childNodes.length ? (
        <ul
          css={(theme) => css`
            margin: var(--ac-global-dimension-static-size-100) 0 0
              var(--ac-global-dimension-static-size-500);
            display: flex;
            flex-direction: column;
            gap: ${theme.spacing.padding8}px;
          `}
        >
          {childNodes.map((leafNode, index) => {
            // The last child does not need an edge connector, a line to connect the nodes
            // after to the parent node
            const needsEdgeConnector = index !== childNodes.length - 1;
            return (
              <div
                key={leafNode.span.context.spanId}
                css={css`
                  position: relative;
                `}
              >
                {needsEdgeConnector ? <SpanTreeEdgeConnector /> : null}
                <SpanTreeEdge />
                <SpanTreeItem
                  node={leafNode}
                  onSpanClick={onSpanClick}
                  selectedSpanId={selectedSpanId}
                />
              </div>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function SpanNodeWrap(props: PropsWithChildren<{ isSelected: boolean }>) {
  return (
    <div
      className={props.isSelected ? "is-selected" : ""}
      css={css`
        border-radius: var(--ac-global-dimension-static-size-150);
        background-color: var(--ac-global-color-gray-500);
        padding: var(--ac-global-dimension-static-size-100);
        border-width: var(--ac-global-dimension-static-size-10);
        border-style: solid;
        border-color: var(--ac-global-color-gray-500);
        &:hover {
          border-color: var(--ac-global-color-gray-200);
          background-color: var(--ac-global-color-gray-400);
        }
        &.is-selected {
          border-color: var(--px-light-blue-color);
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
function SpanTreeEdgeConnector() {
  return (
    <div
      aria-hidden="true"
      data-testid="span-tree-edge-connector"
      css={(theme) => css`
        position: absolute;
        border-left: 1px solid ${theme.colors.arizeLightBlue};
        top: 0;
        left: -22px;
        width: 34px;
        bottom: 0;
      `}
    ></div>
  );
}

function SpanTreeEdge() {
  return (
    <div
      aria-hidden="true"
      css={(theme) => css`
        position: absolute;
        border-left: 1px solid ${theme.colors.arizeLightBlue};
        border-bottom: 1px solid ${theme.colors.arizeLightBlue};
        border-radius: 0 0 0 var(--ac-global-dimension-static-size-150);
        top: -32px;
        left: -22px;
        width: 34px;
        height: 61px;
      `}
    ></div>
  );
}
/**
 * The icon for a span node in the tree
 */
function SpanNodeIcon() {
  return (
    <div
      css={(theme) => css`
        border: 1px solid ${theme.colors.arizeLightBlue};
        width: 10px;
        height: 10px;
        margin: 0 ${theme.spacing.margin4}px;
        border-radius: 3px;
      `}
    ></div>
  );
}
