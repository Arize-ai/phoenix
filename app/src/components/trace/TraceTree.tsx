import React, { PropsWithChildren, startTransition } from "react";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@arizeai/components";

import { TokenCount } from "@phoenix/pages/project/TokenCount";

import { LatencyText } from "./LatencyText";
import { SpanKindIcon } from "./SpanKindIcon";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";
import { ISpanItem, SpanStatusCodeType } from "./types";
import { createSpanTree, SpanTreeNode } from "./utils";

type TraceTreeProps = {
  spans: ISpanItem[];
  onSpanClick?: (span: ISpanItem) => void;
  selectedSpanNodeId: string;
};

export function TraceTree(props: TraceTreeProps) {
  const { spans, onSpanClick, selectedSpanNodeId } = props;
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
          key={spanNode.span.id}
          node={spanNode}
          onSpanClick={onSpanClick}
          selectedSpanNodeId={selectedSpanNodeId}
        />
      ))}
    </ul>
  );
}

function SpanTreeItem<TSpan extends ISpanItem>(props: {
  node: SpanTreeNode<TSpan>;
  selectedSpanNodeId: string;
  onSpanClick?: (span: ISpanItem) => void;
}) {
  const { node, selectedSpanNodeId, onSpanClick } = props;
  const childNodes = node.children;
  return (
    <div>
      <button
        className="button--reset"
        css={css`
          min-width: var(--ac-global-dimension-static-size-4600);
          cursor: pointer;
        `}
        onClick={() => {
          startTransition(() => {
            onSpanClick && onSpanClick(node.span);
          });
        }}
      >
        <SpanNodeWrap isSelected={selectedSpanNodeId === node.span.id}>
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
                  selectedSpanNodeId={selectedSpanNodeId}
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
        padding: var(--ac-global-dimension-static-size-50)
          var(--ac-global-dimension-static-size-200)
          var(--ac-global-dimension-static-size-50)
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
          top: -24px;
          left: -22px;
          width: 38px;
          height: 48px;
        `;
      }}
    ></div>
  );
}

interface SpanItemProps {
  name: string;
  spanKind: string;
  latencyMs: number | null;
  statusCode: SpanStatusCodeType;
  tokenCountTotal?: number | null;
  tokenCountPrompt?: number | null;
  tokenCountCompletion?: number | null;
}

export function SpanItem(props: SpanItemProps) {
  const {
    name,
    latencyMs,
    statusCode,
    tokenCountTotal,
    tokenCountPrompt,
    tokenCountCompletion,
  } = props;
  return (
    <View height="size-500" width="100%">
      <Flex
        direction="row"
        gap="size-150"
        width="100%"
        height="100%"
        alignItems="center"
      >
        <View flex="1 1 auto">
          <div
            css={css`
              float: left;
            `}
          >
            <Text>{name}</Text>
          </div>
        </View>
        {typeof tokenCountTotal === "number" ? (
          <TokenCount
            tokenCountTotal={tokenCountTotal}
            tokenCountPrompt={tokenCountPrompt ?? 0}
            tokenCountCompletion={tokenCountCompletion ?? 0}
          />
        ) : null}
        {latencyMs === null ? null : <LatencyText latencyMs={latencyMs} />}
        {statusCode === "ERROR" ? (
          <SpanStatusCodeIcon statusCode="ERROR" />
        ) : null}
      </Flex>
    </View>
  );
}
