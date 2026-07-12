import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import type { PreloadedQuery } from "react-relay";
import { graphql, usePreloadedQuery, useQueryLoader } from "react-relay";
import type { GraphQLTaggedNode, OperationType } from "relay-runtime";

import {
  ErrorBoundary,
  RichTooltip,
  Skeleton,
  TextErrorBoundaryFallback,
  TooltipTrigger,
  TriggerWrap,
} from "@phoenix/components";
import { DynamicContent } from "@phoenix/components/DynamicContent";

import type { IOValueTooltipCellSessionInputQuery } from "./__generated__/IOValueTooltipCellSessionInputQuery.graphql";
import type { IOValueTooltipCellSessionOutputQuery } from "./__generated__/IOValueTooltipCellSessionOutputQuery.graphql";
import type { IOValueTooltipCellSpanInputQuery } from "./__generated__/IOValueTooltipCellSpanInputQuery.graphql";
import type { IOValueTooltipCellSpanOutputQuery } from "./__generated__/IOValueTooltipCellSpanOutputQuery.graphql";

const spanInputValueTooltipCellQuery = graphql`
  query IOValueTooltipCellSpanInputQuery($id: ID!) {
    node(id: $id) {
      ... on Span {
        input {
          value
        }
      }
    }
  }
`;

const spanOutputValueTooltipCellQuery = graphql`
  query IOValueTooltipCellSpanOutputQuery($id: ID!) {
    node(id: $id) {
      ... on Span {
        output {
          value
        }
      }
    }
  }
`;

const sessionInputValueTooltipCellQuery = graphql`
  query IOValueTooltipCellSessionInputQuery($id: ID!) {
    node(id: $id) {
      ... on ProjectSession {
        firstInput {
          value
        }
      }
    }
  }
`;

const sessionOutputValueTooltipCellQuery = graphql`
  query IOValueTooltipCellSessionOutputQuery($id: ID!) {
    node(id: $id) {
      ... on ProjectSession {
        lastOutput {
          value
        }
      }
    }
  }
`;

const triggerCSS = css`
  overflow: hidden;
  text-overflow: ellipsis;

  [role="button"] {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const tooltipCSS = css`
  min-width: min(
    var(--global-dimension-size-4000),
    calc(100vw - var(--global-dimension-size-400))
  );
  max-width: min(
    var(--global-dimension-size-5000),
    calc(100vw - var(--global-dimension-size-400))
  );
  max-height: min(480px, calc(100vh - 64px));
  overflow: auto;
  white-space: normal;
  word-break: break-word;
`;

const loadingCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-static-size-100);
`;

function formatPreview(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    return "--";
  }
  return value;
}

function IOValueTooltipSkeleton() {
  return (
    <div css={loadingCSS} aria-label="Loading full value">
      <Skeleton width="90%" height="1em" />
      <Skeleton width="75%" height="1em" />
      <Skeleton width="82%" height="1em" />
    </div>
  );
}

/**
 * Renders a truncated table value and loads its full value on hover/focus.
 * @param props - Cell configuration.
 * @param props.children - Lazy query content or its loading state.
 * @param props.onOpen - Called when the tooltip opens.
 * @param props.preview - Truncated value included in the table query.
 */
function IOValueTooltipCell({
  children,
  onOpen,
  preview,
}: {
  children: ReactNode;
  onOpen: () => void;
  preview: unknown;
}) {
  const previewText = formatPreview(preview);

  if (previewText === "--") {
    return <span>{previewText}</span>;
  }

  return (
    <TooltipTrigger
      delay={350}
      closeDelay={100}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          onOpen();
        }
      }}
    >
      <TriggerWrap css={triggerCSS}>
        <span>{previewText}</span>
      </TriggerWrap>
      <RichTooltip placement="bottom start" width="auto" css={tooltipCSS}>
        <ErrorBoundary fallback={TextErrorBoundaryFallback}>
          <Suspense fallback={<IOValueTooltipSkeleton />}>{children}</Suspense>
        </ErrorBoundary>
      </RichTooltip>
    </TooltipTrigger>
  );
}

/**
 * Builds a table cell component that shows a truncated preview and lazily
 * loads the full IO value into a tooltip on hover/focus. Each variant needs
 * its own static Relay query, so the query and its value accessor are bound
 * here while all behavior lives in {@link IOValueTooltipCell}.
 * @param params - Variant configuration.
 * @param params.query - Static Relay query fetching the full value by node id.
 * @param params.getFullValue - Extracts the full value from the query response.
 */
function createIOValueTooltipCell<TQuery extends OperationType>({
  query,
  getFullValue,
}: {
  query: GraphQLTaggedNode;
  getFullValue: (data: TQuery["response"]) => string | null | undefined;
}) {
  function TooltipContent({ queryRef }: { queryRef: PreloadedQuery<TQuery> }) {
    const data = usePreloadedQuery<TQuery>(query, queryRef);
    return <DynamicContent value={getFullValue(data)} />;
  }

  return function Cell({
    nodeId,
    preview,
  }: {
    nodeId: string;
    preview: unknown;
  }) {
    const [queryRef, loadQuery] = useQueryLoader<TQuery>(query);
    return (
      <IOValueTooltipCell
        preview={preview}
        onOpen={() => {
          if (queryRef == null) {
            loadQuery(
              { id: nodeId } as TQuery["variables"],
              { fetchPolicy: "store-or-network" }
            );
          }
        }}
      >
        {queryRef ? (
          <TooltipContent queryRef={queryRef} />
        ) : (
          <IOValueTooltipSkeleton />
        )}
      </IOValueTooltipCell>
    );
  };
}

export const SpanInputValueTooltipCell =
  createIOValueTooltipCell<IOValueTooltipCellSpanInputQuery>({
    query: spanInputValueTooltipCellQuery,
    getFullValue: (data) => data.node?.input?.value,
  });

export const SpanOutputValueTooltipCell =
  createIOValueTooltipCell<IOValueTooltipCellSpanOutputQuery>({
    query: spanOutputValueTooltipCellQuery,
    getFullValue: (data) => data.node?.output?.value,
  });

export const SessionInputValueTooltipCell =
  createIOValueTooltipCell<IOValueTooltipCellSessionInputQuery>({
    query: sessionInputValueTooltipCellQuery,
    getFullValue: (data) => data.node?.firstInput?.value,
  });

export const SessionOutputValueTooltipCell =
  createIOValueTooltipCell<IOValueTooltipCellSessionOutputQuery>({
    query: sessionOutputValueTooltipCellQuery,
    getFullValue: (data) => data.node?.lastOutput?.value,
  });
