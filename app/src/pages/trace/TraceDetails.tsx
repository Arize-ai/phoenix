import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { Suspense, useState } from "react";
import { Focusable } from "react-aria";
import { graphql, useLazyLoadQuery } from "react-relay";
import { useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import {
  SessionDetailPanelAnnotationBar,
  SessionDetailPanelAnnotationButton,
  SpanDetailPanelAnnotationButton,
  TraceDetailPanelAnnotationButton,
} from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanStatusBadge } from "@phoenix/components/trace/SpanStatusBadge";
import { TokenCostsDetails } from "@phoenix/components/trace/TokenCostsDetails";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeToolbar } from "@phoenix/components/trace/TraceTreeToolbar";
import type {
  SpanDetailsPreview,
  SpanStatusCodeType,
} from "@phoenix/components/trace/types";
import {
  SELECTED_SESSION_NODE_ID_PARAM,
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
} from "@phoenix/constants/searchParams";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";
import { getTraceDetailsPath } from "@phoenix/utils/urlUtils";

import type {
  TraceDetailsQuery,
  TraceDetailsQuery$data,
} from "./__generated__/TraceDetailsQuery.graphql";
import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { DetailsPanelContent } from "./DetailsPanel";
import { SessionDetailsHeader } from "./SessionDetailsHeader";
import { SessionConversationSkeleton } from "./SessionDetailsSkeleton";
import {
  SessionConversation,
  type SessionTraceUrlBuilder,
} from "./SessionDetailsTraceList";
import { SpanDetailsPaintGate } from "./SpanDetailsPaintGate";
import { SpanInfoCardsProvider } from "./SpanInfoCardsContext";
import { DetailPanelAnnotationBarSkeleton } from "./TraceDetailsSkeleton";
import { TraceTurnDetails } from "./TraceTurnDetails";

type RootSpan = NonNullable<
  TraceDetailsQuery$data["project"]["trace"]
>["rootSpans"]["edges"][number]["span"];

export type TraceHeaderCostSummary = {
  completion?: { cost: number | null } | null;
  prompt?: { cost: number | null } | null;
  total?: { cost: number | null } | null;
};

export type TraceDetailsProps = {
  defaultToTrace?: boolean;
  traceId: string;
  projectId: string;
  isTreePanelCollapsed?: boolean;
  onTreePanelCollapsedChange?: (isCollapsed: boolean) => void;
  treeHeader?: ReactNode;
};

type LocalSpanSelection = {
  isRouteCommitPending: boolean;
  spanPreview: SpanDetailsPreview;
};

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TraceDetails({
  defaultToTrace = false,
  traceId,
  projectId,
  isTreePanelCollapsed,
  onTreePanelCollapsedChange,
  treeHeader,
}: TraceDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localSpanSelection, setLocalSpanSelection] =
    useState<LocalSpanSelection | null>(null);
  const data = useLazyLoadQuery<TraceDetailsQuery>(
    graphql`
      query TraceDetailsQuery($traceId: ID!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            trace(traceId: $traceId) {
              id
              traceId
              errorCount
              session {
                id
                sessionId
                tokenUsage {
                  total
                }
                costSummary {
                  total {
                    cost
                  }
                }
              }
              ...ConnectedTraceTree
              rootSpans: spans(
                first: 1
                rootSpansOnly: true
                orphanSpanAsRootSpan: true
              ) {
                edges {
                  span: node {
                    id
                    spanId
                    parentId
                    statusCode
                    latencyMs
                    startTime
                    cumulativeTokenCountTotal
                    trace {
                      costSummary {
                        total {
                          cost
                        }
                      }
                    }
                    ...TraceTurnContent_rootSpan
                  }
                }
              }
            }
          }
        }
      }
    `,
    { traceId, id: projectId },
    {
      fetchPolicy: "store-and-network",
    }
  );
  invariant(data.project.trace, "Trace is required to view the trace details");
  const trace = data.project.trace;
  const gqlSpans = trace.rootSpans.edges || [];
  const rootSpans: RootSpan[] = gqlSpans.map((node) => node.span);
  const urlSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  const urlSessionNodeId = searchParams.get(SELECTED_SESSION_NODE_ID_PARAM);
  const urlTraceId = searchParams.get(SELECTED_TRACE_ID_PARAM);
  invariant(rootSpans.length > 0, "At least one root must be resolvable");
  const rootSpan = rootSpans[0];
  const isRouteTraceSelected =
    urlSpanNodeId == null && (defaultToTrace || urlTraceId === trace.traceId);
  const isLocalSpanSelectionCurrent =
    localSpanSelection != null &&
    (localSpanSelection.isRouteCommitPending ||
      localSpanSelection.spanPreview.id === urlSpanNodeId);
  const selectedSpanPreview = isLocalSpanSelectionCurrent
    ? localSpanSelection.spanPreview
    : undefined;
  const session = trace.session;
  const isSessionSelected =
    selectedSpanPreview == null &&
    session != null &&
    urlSessionNodeId === session.id;
  const isTraceSelected =
    !isSessionSelected && selectedSpanPreview == null && isRouteTraceSelected;
  const selectedSpanNodeId =
    selectedSpanPreview?.id ??
    (isSessionSelected
      ? null
      : (urlSpanNodeId ?? (isTraceSelected ? null : rootSpan.id)));
  const isTraceActive = isTraceSelected || selectedSpanNodeId != null;
  const treeSession = session
    ? {
        actions: (
          <SessionDetailPanelAnnotationButton sessionNodeId={session.id} />
        ),
        isSelected: isSessionSelected,
        onSelect: () => {
          setLocalSpanSelection(null);
          setSearchParams(
            (searchParams) => {
              searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
              searchParams.delete(SELECTED_TRACE_ID_PARAM);
              searchParams.set(SELECTED_SESSION_NODE_ID_PARAM, session.id);
              return searchParams;
            },
            { replace: true, flushSync: true }
          );
        },
        sessionId: session.sessionId,
      }
    : undefined;
  const getSessionTraceUrl: SessionTraceUrlBuilder = ({ traceId }) =>
    `/projects/${projectId}/traces/${getTraceDetailsPath({
      traceId,
      searchParams,
    })}`;

  return (
    <DetailsPanelContent
      navigation={
        <TraceTreeProvider key={trace.id} errorCount={trace.errorCount}>
          {treeHeader}
          <TraceTreeToolbar
            isTreePanelCollapsed={isTreePanelCollapsed}
            onTreePanelCollapsedChange={onTreePanelCollapsedChange}
          />
          <ConnectedTraceTree
            trace={trace}
            isNavigationCollapsed={isTreePanelCollapsed}
            session={treeSession}
            selectedSpanNodeId={selectedSpanNodeId ?? ""}
            traceSelection={{
              actions: (
                <TraceDetailPanelAnnotationButton traceNodeId={trace.id} />
              ),
              isActive: isTraceActive,
              isSelected: isTraceSelected,
              cost: rootSpan.trace.costSummary?.total?.cost,
              onSelect: () => {
                setLocalSpanSelection(null);
                setSearchParams(
                  (searchParams) => {
                    searchParams.delete(SELECTED_SESSION_NODE_ID_PARAM);
                    searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
                    searchParams.set(SELECTED_TRACE_ID_PARAM, trace.traceId);
                    return searchParams;
                  },
                  { replace: true, flushSync: true }
                );
              },
              tokenCountTotal: rootSpan.cumulativeTokenCountTotal,
              traceId: trace.traceId,
            }}
            onSpanSelectionStart={(span) => {
              setLocalSpanSelection({
                isRouteCommitPending: true,
                spanPreview: {
                  ...span,
                  projectId,
                  traceId: trace.traceId,
                },
              });
            }}
            onSpanClick={(span) => {
              setSearchParams(
                (searchParams) => {
                  searchParams.delete(SELECTED_SESSION_NODE_ID_PARAM);
                  searchParams.delete(SELECTED_TRACE_ID_PARAM);
                  searchParams.set(SELECTED_SPAN_NODE_ID_PARAM, span.id);
                  return searchParams;
                },
                { replace: true, flushSync: true }
              );
              setLocalSpanSelection({
                isRouteCommitPending: false,
                spanPreview: {
                  ...span,
                  projectId,
                  traceId: trace.traceId,
                },
              });
            }}
            renderSpanActions={(span) => (
              <SpanDetailPanelAnnotationButton spanNodeId={span.id} />
            )}
          />
        </TraceTreeProvider>
      }
    >
      <SpanInfoCardsProvider>
        <SpanDetailsWrapper>
          {isSessionSelected && session ? (
            <TraceSessionDetails
              getTraceUrl={getSessionTraceUrl}
              session={session}
            />
          ) : isTraceSelected ? (
            <TraceTurnDetails
              traceId={trace.traceId}
              traceNodeId={trace.id}
              rootSpan={rootSpan}
            />
          ) : selectedSpanNodeId ? (
            <SpanDetailsPaintGate
              spanNodeId={selectedSpanNodeId}
              spanPreview={selectedSpanPreview}
            />
          ) : null}
        </SpanDetailsWrapper>
      </SpanInfoCardsProvider>
    </DetailsPanelContent>
  );
}

type TraceSession = NonNullable<
  TraceDetailsQuery$data["project"]["trace"]
>["session"];

function TraceSessionDetails({
  getTraceUrl,
  session,
}: {
  getTraceUrl: SessionTraceUrlBuilder;
  session: NonNullable<TraceSession>;
}) {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      <SessionDetailsHeader
        annotationBar={
          <Suspense
            fallback={
              <DetailPanelAnnotationBarSkeleton variant="detail-header" />
            }
          >
            <SessionDetailPanelAnnotationBar sessionNodeId={session.id} />
          </Suspense>
        }
        preview={{
          sessionId: session.id,
          sessionDisplayId: session.sessionId,
          tokenCountTotal: session.tokenUsage.total,
          totalCost: session.costSummary.total.cost,
        }}
      />
      <div
        css={css`
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;
        `}
      >
        <Suspense fallback={<SessionConversationSkeleton />}>
          <SessionConversation
            getTraceUrl={getTraceUrl}
            sessionId={session.id}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** Presentational trace metrics header used by the trace details page. */
export function TraceHeaderContent({
  statusCode,
  latencyMs,
  costSummary,
  annotationSummaries,
  trailingAction,
}: {
  statusCode: SpanStatusCodeType;
  latencyMs: number | null;
  costSummary?: TraceHeaderCostSummary | null;
  annotationSummaries?: ReactNode;
  trailingAction?: ReactNode;
}) {
  return (
    <View
      paddingTop="size-100"
      paddingBottom="size-150"
      paddingX="size-200"
      borderBottomWidth="thin"
      borderBottomColor="default"
    >
      <Flex
        direction="row"
        gap="size-400"
        alignItems="start"
        css={css`
          box-sizing: content-box;
        `}
      >
        <Flex
          direction="column"
          alignItems="start"
          css={css`
            align-self: stretch;
          `}
        >
          <Text elementType="h3" size="S" color="text-700">
            Status
          </Text>
          <div
            css={css`
              flex: 1 1 auto;
              display: flex;
              align-items: center;
            `}
          >
            <SpanStatusBadge statusCode={statusCode} labelVariant="full" />
          </div>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" size="S" color="text-700">
            Total Cost
          </Text>
          <TooltipTrigger delay={0}>
            <Focusable>
              <Text size="L" role="button">
                {costFormatter(costSummary?.total?.cost ?? 0)}
              </Text>
            </Focusable>
            <RichTooltip placement="bottom">
              <TooltipArrow />
              <View width="size-3500">
                <TokenCostsDetails
                  total={costSummary?.total?.cost ?? 0}
                  prompt={costSummary?.prompt?.cost ?? 0}
                  completion={costSummary?.completion?.cost ?? 0}
                />
              </View>
            </RichTooltip>
          </TooltipTrigger>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" size="S" color="text-700">
            Latency
          </Text>
          {typeof latencyMs === "number" ? (
            <LatencyText latencyMs={latencyMs} size="L" />
          ) : (
            <Text size="L">--</Text>
          )}
        </Flex>
        {annotationSummaries}
        {trailingAction ? (
          <span
            css={css`
              align-self: center;
              margin-left: auto;
            `}
          >
            {trailingAction}
          </span>
        ) : null}
      </Flex>
    </View>
  );
}

function SpanDetailsWrapper({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="scrolling-tabs-wrapper"
      css={css`
        width: 100%;
        height: 100%;
        overflow: hidden;
      `}
    >
      {children}
    </div>
  );
}
