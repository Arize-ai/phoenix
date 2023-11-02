import React, { PropsWithChildren } from "react";
import { css } from "@emotion/react";

import { Flex } from "@arizeai/components";

import { SpanItem } from "./SpanItem";
import { SpanKindIcon } from "./SpanKindIcon";
import { ISpanItem, SpanStatusCodeType } from "./types";
import { createSpanTree, SpanTreeNode } from "./utils";

type TraceTreeProps = {
  spans: ISpanItem[];
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

function SpanTreeItem<TSpan extends ISpanItem>(props: {
  node: SpanTreeNode<TSpan>;
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
          cursor: pointer;
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
            <SpanKindIcon spanKind={node.span.spanKind} />
            <SpanItem {...node.span} />
          </Flex>
        </SpanNodeWrap>
      </button>
      {childNodes.length ? (
        <ul
          css={(theme) => css`
            margin: var(--ac-global-dimension-static-size-100) 0 0
              var(--ac-global-dimension-static-size-600);
            display: flex;
            flex-direction: column;
            gap: ${theme.spacing.padding8}px;
          `}
        >
          {childNodes.map((leafNode, index) => {
            // The last child does not need an edge connector, a line to connect the nodes
            // after to the parent node
            const nexSibling = childNodes[index + 1];
            return (
              <div
                key={leafNode.span.context.spanId}
                css={css`
                  position: relative;
                `}
              >
                {nexSibling ? (
                  <SpanTreeEdgeConnector {...nexSibling.span} />
                ) : null}
                <SpanTreeEdge {...leafNode.span} />
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
        background-color: var(--ac-global-color-grey-200);
        padding: var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-200)
          var(--ac-global-dimension-static-size-100)
          var(--ac-global-dimension-static-size-200);
        border-width: var(--ac-global-dimension-static-size-10);
        border-style: solid;
        border-color: var(--ac-global-color-grey-300);
        &:hover {
          border-color: var(--ac-global-color-grey-400);
          background-color: var(--ac-global-color-grey-300);
        }
        &.is-selected {
          border-color: var(--ac-global-color-primary);
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
}: {
  statusCode: SpanStatusCodeType;
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
            : "rgb(204, 204, 204)"};
        top: 0;
        left: -22px;
        width: 42px;
        bottom: 0;
      `}
    ></div>
  );
}

function SpanTreeEdge({ statusCode }: { statusCode: SpanStatusCodeType }) {
  return (
    <div
      aria-hidden="true"
      css={(theme) => {
        const color =
          statusCode === "ERROR"
            ? theme.colors.statusDanger
            : "rgb(204, 204, 204)";
        return css`
          position: absolute;
          border-left: 1px solid ${color};
          border-bottom: 1px solid ${color};
          border-radius: 0 0 0 var(--ac-global-dimension-static-size-150);
          top: -27px;
          left: -22px;
          width: 38px;
          height: 56px;
        `;
      }}
    ></div>
  );
}
