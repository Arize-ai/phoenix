import { css } from "@emotion/react";
import {
  Children,
  createContext,
  Fragment,
  isValidElement,
  type PropsWithChildren,
  type ReactNode,
  useContext,
} from "react";

import { Flex } from "@phoenix/components";
import { Skeleton } from "@phoenix/components/core/loading/Skeleton";
import { usePreferencesContext } from "@phoenix/contexts/PreferencesContext";

import { NESTING_INDENT, traceTreeListCSS } from "./traceTreeStyles";

const NestingLevelContext = createContext(0);

const containerCSS = css`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  align-items: stretch;
  container-type: inline-size;
`;

const listOverflowCSS = css`
  overflow: hidden;
`;

export interface TraceTreeSkeletonProps {
  children?: ReactNode;
}

/**
 * Skeleton placeholder for `TraceTree`. Accepts `TraceTreeNodeSkeleton`
 * children to shape the tree, or renders a default tree when empty.
 */
export function TraceTreeSkeleton({ children }: TraceTreeSkeletonProps) {
  return (
    <div css={containerCSS}>
      <ul
        css={[traceTreeListCSS, listOverflowCSS]}
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
   * Width of the span-name placeholder. Pass a number (px) or CSS length.
   * @default 180
   */
  nameWidth?: number | string;
  /**
   * Nested `TraceTreeNodeSkeleton` children. Nesting level is threaded via
   * context so callers don't need to pass it explicitly.
   */
  children?: ReactNode;
}

export function TraceTreeNodeSkeleton({
  nameWidth = 180,
  children,
}: TraceTreeNodeSkeletonProps) {
  const nestingLevel = useContext(NestingLevelContext);
  const childArray = Children.toArray(children).filter(isValidElement);
  const hasChildren = childArray.length > 0;

  return (
    <Fragment>
      <SpanNodeRowSkeleton
        nestingLevel={nestingLevel}
        nameWidth={nameWidth}
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
                >
                  {hasSiblingBelow ? (
                    <EdgeConnectorSkeleton nestingLevel={nestingLevel} />
                  ) : null}
                  <EdgeSkeleton nestingLevel={nestingLevel} />
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
  nameWidth,
  hasChildren,
}: {
  nestingLevel: number;
  nameWidth: number | string;
  hasChildren: boolean;
}) {
  const showMetricsInTraceTree = usePreferencesContext(
    (state) => state.showMetricsInTraceTree
  );
  return (
    <SpanNodeWrapSkeleton nestingLevel={nestingLevel}>
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
        <Skeleton width={20} height={20} borderRadius="S" animation="wave" />
        <Skeleton
          width={nameWidth}
          height={14}
          borderRadius="S"
          animation="wave"
        />
      </Flex>
      {showMetricsInTraceTree ? (
        <div css={spanTimingCSS} className="span-tree-timing">
          <Skeleton width={36} height={10} borderRadius="S" animation="wave" />
          <div
            css={css`
              flex: 1 1 auto;
            `}
          >
            <Skeleton
              width="100%"
              height={6}
              borderRadius={3}
              animation="wave"
            />
          </div>
        </div>
      ) : null}
      <div css={spanControlsCSS} className="span-controls">
        {hasChildren ? (
          <Skeleton width={20} height={20} borderRadius="S" animation="wave" />
        ) : null}
      </div>
    </SpanNodeWrapSkeleton>
  );
}

function SpanNodeWrapSkeleton(
  props: PropsWithChildren<{ nestingLevel: number }>
) {
  return (
    <div
      className="span-node-wrap"
      css={css`
        width: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        gap: var(--global-dimension-static-size-100);
        padding-right: var(--global-dimension-static-size-100);
        padding-top: var(--global-dimension-static-size-100);
        padding-bottom: var(--global-dimension-static-size-100);
        border-left: 4px solid transparent;
        box-sizing: border-box;
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

function EdgeConnectorSkeleton({ nestingLevel }: { nestingLevel: number }) {
  return (
    <div
      className="span-tree-edge-connector"
      css={css`
        position: absolute;
        border-left: 1px solid var(--global-color-gray-300);
        top: 0;
        left: ${nestingLevel * NESTING_INDENT + 29}px;
        width: 42px;
        bottom: 0;
        z-index: 1;
      `}
    />
  );
}

function EdgeSkeleton({ nestingLevel }: { nestingLevel: number }) {
  return (
    <div
      className="span-tree-edge"
      css={css`
        position: absolute;
        border-left: 1px solid var(--global-color-gray-300);
        border-bottom: 1px solid var(--global-color-gray-300);
        border-radius: 0 0 0 11px;
        top: -5px;
        left: ${nestingLevel * NESTING_INDENT + 29}px;
        width: 11px;
        height: 22px;
      `}
    />
  );
}

const spanControlsCSS = css`
  width: 20px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const spanTimingCSS = css`
  gap: var(--global-dimension-static-size-100);
  width: 150px;
  flex: none;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

function DefaultTraceTreeSkeletonBody() {
  return (
    <TraceTreeNodeSkeleton nameWidth={200}>
      <TraceTreeNodeSkeleton nameWidth={180}>
        <TraceTreeNodeSkeleton nameWidth={160}>
          <TraceTreeNodeSkeleton nameWidth={220} />
          <TraceTreeNodeSkeleton nameWidth={200}>
            <TraceTreeNodeSkeleton nameWidth={170} />
          </TraceTreeNodeSkeleton>
        </TraceTreeNodeSkeleton>
        <TraceTreeNodeSkeleton nameWidth={140} />
      </TraceTreeNodeSkeleton>
      <TraceTreeNodeSkeleton nameWidth={180}>
        <TraceTreeNodeSkeleton nameWidth={160} />
      </TraceTreeNodeSkeleton>
    </TraceTreeNodeSkeleton>
  );
}
