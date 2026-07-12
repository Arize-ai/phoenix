import { css } from "@emotion/react";
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

import type { IOValueTooltipCellQuery } from "./__generated__/IOValueTooltipCellQuery.graphql";

type IOValueKind = "input" | "output";

const ioValueTooltipCellQuery = graphql`
  query IOValueTooltipCellQuery(
    $id: ID!
    $includeInput: Boolean!
    $includeOutput: Boolean!
  ) {
    node(id: $id) {
      __typename
      ... on Span {
        input @include(if: $includeInput) {
          value
        }
        output @include(if: $includeOutput) {
          value
        }
      }
      ... on ProjectSession {
        firstInput @include(if: $includeInput) {
          value
        }
        lastOutput @include(if: $includeOutput) {
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
    var(--global-dimension-size-3000),
    calc(100vw - var(--global-dimension-size-400))
  );
  max-width: min(
    var(--global-dimension-size-6000),
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

function IOValueTooltipContent({
  kind,
  queryRef,
}: {
  kind: IOValueKind;
  queryRef: NonNullable<
    ReturnType<typeof useQueryLoader<IOValueTooltipCellQuery>>[0]
  >;
}) {
  const data = usePreloadedQuery(ioValueTooltipCellQuery, queryRef);
  const node = data.node;
  let value: unknown = null;

  if (node?.__typename === "Span") {
    value = kind === "input" ? node.input?.value : node.output?.value;
  } else if (node?.__typename === "ProjectSession") {
    value = kind === "input" ? node.firstInput?.value : node.lastOutput?.value;
  }

  return <DynamicContent value={value} />;
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
 * Renders a truncated table value and loads its full node value on hover/focus.
 * @param props - Cell configuration.
 * @param props.kind - Whether to load the node's input or output value.
 * @param props.nodeId - Relay node ID for the span or project session.
 * @param props.preview - Truncated value included in the table query.
 */
export function IOValueTooltipCell({
  kind,
  nodeId,
  preview,
}: {
  kind: IOValueKind;
  nodeId: string;
  preview: unknown;
}) {
  const [queryRef, loadQuery] = useQueryLoader<IOValueTooltipCellQuery>(
    ioValueTooltipCellQuery
  );
  const previewText = formatPreview(preview);

  if (previewText === "--") {
    return <span>{previewText}</span>;
  }

  return (
    <TooltipTrigger
      delay={350}
      closeDelay={100}
      onOpenChange={(isOpen) => {
        if (isOpen && queryRef == null) {
          loadQuery(
            {
              id: nodeId,
              includeInput: kind === "input",
              includeOutput: kind === "output",
            },
            { fetchPolicy: "network-only" }
          );
        }
      }}
    >
      <TriggerWrap css={triggerCSS}>
        <span>{previewText}</span>
      </TriggerWrap>
      <RichTooltip placement="bottom start" width="auto" css={tooltipCSS}>
        <ErrorBoundary fallback={TextErrorBoundaryFallback}>
          <Suspense fallback={<IOValueTooltipSkeleton />}>
            {queryRef ? (
              <IOValueTooltipContent kind={kind} queryRef={queryRef} />
            ) : (
              <IOValueTooltipSkeleton />
            )}
          </Suspense>
        </ErrorBoundary>
      </RichTooltip>
    </TooltipTrigger>
  );
}
