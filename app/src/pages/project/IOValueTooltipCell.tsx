import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { graphql, usePreloadedQuery, useQueryLoader } from "react-relay";

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

function SpanInputValueTooltipContent({
  queryRef,
}: {
  queryRef: NonNullable<
    ReturnType<typeof useQueryLoader<IOValueTooltipCellSpanInputQuery>>[0]
  >;
}) {
  const data = usePreloadedQuery(spanInputValueTooltipCellQuery, queryRef);
  return <DynamicContent value={data.node?.input?.value} />;
}

function SpanOutputValueTooltipContent({
  queryRef,
}: {
  queryRef: NonNullable<
    ReturnType<typeof useQueryLoader<IOValueTooltipCellSpanOutputQuery>>[0]
  >;
}) {
  const data = usePreloadedQuery(spanOutputValueTooltipCellQuery, queryRef);
  return <DynamicContent value={data.node?.output?.value} />;
}

function SessionInputValueTooltipContent({
  queryRef,
}: {
  queryRef: NonNullable<
    ReturnType<typeof useQueryLoader<IOValueTooltipCellSessionInputQuery>>[0]
  >;
}) {
  const data = usePreloadedQuery(sessionInputValueTooltipCellQuery, queryRef);
  return <DynamicContent value={data.node?.firstInput?.value} />;
}

function SessionOutputValueTooltipContent({
  queryRef,
}: {
  queryRef: NonNullable<
    ReturnType<typeof useQueryLoader<IOValueTooltipCellSessionOutputQuery>>[0]
  >;
}) {
  const data = usePreloadedQuery(sessionOutputValueTooltipCellQuery, queryRef);
  return <DynamicContent value={data.node?.lastOutput?.value} />;
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

export function SpanInputValueTooltipCell({
  nodeId,
  preview,
}: {
  nodeId: string;
  preview: unknown;
}) {
  const [queryRef, loadQuery] =
    useQueryLoader<IOValueTooltipCellSpanInputQuery>(
      spanInputValueTooltipCellQuery
    );
  return (
    <IOValueTooltipCell
      preview={preview}
      onOpen={() => {
        if (queryRef == null) {
          loadQuery({ id: nodeId }, { fetchPolicy: "store-or-network" });
        }
      }}
    >
      {queryRef ? (
        <SpanInputValueTooltipContent queryRef={queryRef} />
      ) : (
        <IOValueTooltipSkeleton />
      )}
    </IOValueTooltipCell>
  );
}

export function SpanOutputValueTooltipCell({
  nodeId,
  preview,
}: {
  nodeId: string;
  preview: unknown;
}) {
  const [queryRef, loadQuery] =
    useQueryLoader<IOValueTooltipCellSpanOutputQuery>(
      spanOutputValueTooltipCellQuery
    );
  return (
    <IOValueTooltipCell
      preview={preview}
      onOpen={() => {
        if (queryRef == null) {
          loadQuery({ id: nodeId }, { fetchPolicy: "store-or-network" });
        }
      }}
    >
      {queryRef ? (
        <SpanOutputValueTooltipContent queryRef={queryRef} />
      ) : (
        <IOValueTooltipSkeleton />
      )}
    </IOValueTooltipCell>
  );
}

export function SessionInputValueTooltipCell({
  nodeId,
  preview,
}: {
  nodeId: string;
  preview: unknown;
}) {
  const [queryRef, loadQuery] =
    useQueryLoader<IOValueTooltipCellSessionInputQuery>(
      sessionInputValueTooltipCellQuery
    );
  return (
    <IOValueTooltipCell
      preview={preview}
      onOpen={() => {
        if (queryRef == null) {
          loadQuery({ id: nodeId }, { fetchPolicy: "store-or-network" });
        }
      }}
    >
      {queryRef ? (
        <SessionInputValueTooltipContent queryRef={queryRef} />
      ) : (
        <IOValueTooltipSkeleton />
      )}
    </IOValueTooltipCell>
  );
}

export function SessionOutputValueTooltipCell({
  nodeId,
  preview,
}: {
  nodeId: string;
  preview: unknown;
}) {
  const [queryRef, loadQuery] =
    useQueryLoader<IOValueTooltipCellSessionOutputQuery>(
      sessionOutputValueTooltipCellQuery
    );
  return (
    <IOValueTooltipCell
      preview={preview}
      onOpen={() => {
        if (queryRef == null) {
          loadQuery({ id: nodeId }, { fetchPolicy: "store-or-network" });
        }
      }}
    >
      {queryRef ? (
        <SessionOutputValueTooltipContent queryRef={queryRef} />
      ) : (
        <IOValueTooltipSkeleton />
      )}
    </IOValueTooltipCell>
  );
}
