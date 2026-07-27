import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";
import { Suspense } from "react";
import { Focusable } from "react-aria";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Group, Panel } from "react-resizable-panels";
import { useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import {
  Flex,
  Loading,
  RichTooltip,
  Text,
  TooltipArrow,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { TraceDetailPanelAnnotationBar } from "@phoenix/components/annotation/ConnectedDetailPanelAnnotationBar";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import {
  ResizableTraceTreePanelContent,
  ResizableTraceTreeSeparator,
  resizableTraceTreePanelStyle,
} from "@phoenix/components/trace/ResizableTraceTreePanelContent";
import { SpanStatusBadge } from "@phoenix/components/trace/SpanStatusBadge";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeToolbar } from "@phoenix/components/trace/TraceTreeToolbar";
import type { SpanStatusCodeType } from "@phoenix/components/trace/types";
import {
  SPAN_DETAILS_MIN_WIDTH_PIXELS,
  TRACE_TREE_MIN_WIDTH_PIXELS,
} from "@phoenix/constants";
import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
} from "@phoenix/constants/searchParams";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";
import { getSessionDetailsPath } from "@phoenix/utils/urlUtils";

import { RichTokenBreakdown } from "../../components/RichTokenCostBreakdown";
import type {
  TraceDetailsQuery,
  TraceDetailsQuery$data,
} from "./__generated__/TraceDetailsQuery.graphql";
import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { SpanDetails } from "./SpanDetails";
import { usePreferredTreePanel } from "./useDetailsPanelSizing";

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
  preferredTreeWidth: number;
  onPreferredTreeWidthChange: (width: number) => void;
  treeHeader?: ReactNode;
};

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TraceDetails({
  defaultToTrace = false,
  traceId,
  projectId,
  preferredTreeWidth,
  onPreferredTreeWidthChange,
  treeHeader,
}: TraceDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<TraceDetailsQuery>(
    graphql`
      query TraceDetailsQuery($traceId: ID!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            trace(traceId: $traceId) {
              id
              traceId
              session {
                id
                sessionId
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
  const gqlSpans = data.project.trace?.rootSpans.edges || [];
  const rootSpans: RootSpan[] = gqlSpans.map((node) => node.span);
  const urlSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  const urlTraceId = searchParams.get(SELECTED_TRACE_ID_PARAM);
  invariant(rootSpans.length > 0, "At least one root must be resolvable");
  const rootSpan = rootSpans[0];
  const isTraceSelected =
    urlSpanNodeId == null &&
    (defaultToTrace || urlTraceId === data.project.trace.traceId);
  const selectedSpanNodeId =
    urlSpanNodeId ?? (isTraceSelected ? null : rootSpan.id);
  const session = data.project.trace.session;
  const treeSession = session
    ? {
        sessionId: session.sessionId,
        to: `/projects/${projectId}/sessions/${getSessionDetailsPath({
          sessionId: session.id,
          searchParams,
        })}`,
      }
    : undefined;

  const {
    groupElementRef,
    onLayoutChanged,
    onTreeResize,
    onTreeResizeEnd,
    onTreeResizeStart,
    treePanelRef,
  } = usePreferredTreePanel({
    preferredTreeWidth,
    onPreferredTreeWidthChange,
  });

  return (
    <main
      css={css`
        flex: 1 1 auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      `}
    >
      <Group
        elementRef={groupElementRef}
        orientation="horizontal"
        onLayoutChanged={onLayoutChanged}
        className="details-panel-columns"
        css={css`
          flex: 1 1 auto;
          overflow: hidden;
        `}
      >
        <Panel
          id="details-panel-tree-column"
          panelRef={treePanelRef}
          defaultSize={preferredTreeWidth}
          minSize={TRACE_TREE_MIN_WIDTH_PIXELS}
          groupResizeBehavior="preserve-pixel-size"
          css={css`
            container-name: trace-tree-panel;
            container-type: inline-size;
          `}
          style={resizableTraceTreePanelStyle}
        >
          <TraceTreeProvider>
            <ResizableTraceTreePanelContent>
              {treeHeader}
              <TraceTreeToolbar />
              <ConnectedTraceTree
                trace={data.project.trace}
                session={treeSession}
                selectedSpanNodeId={selectedSpanNodeId ?? ""}
                traceSelection={{
                  isSelected: isTraceSelected,
                  onSelect: () => {
                    setSearchParams(
                      (searchParams) => {
                        searchParams.delete(SELECTED_SPAN_NODE_ID_PARAM);
                        searchParams.set(
                          SELECTED_TRACE_ID_PARAM,
                          data.project.trace.traceId
                        );
                        return searchParams;
                      },
                      { replace: true }
                    );
                  },
                  traceId: data.project.trace.traceId,
                }}
                onSpanClick={(span) => {
                  setSearchParams(
                    (searchParams) => {
                      searchParams.delete(SELECTED_TRACE_ID_PARAM);
                      searchParams.set(SELECTED_SPAN_NODE_ID_PARAM, span.id);
                      return searchParams;
                    },
                    { replace: true }
                  );
                }}
              />
            </ResizableTraceTreePanelContent>
          </TraceTreeProvider>
        </Panel>
        <ResizableTraceTreeSeparator
          onResize={onTreeResize}
          onResizeEnd={onTreeResizeEnd}
          onResizeStart={onTreeResizeStart}
        />
        <Panel
          id="details-panel-main-column"
          minSize={SPAN_DETAILS_MIN_WIDTH_PIXELS}
        >
          <SpanDetailsWrapper>
            {isTraceSelected ? (
              <Suspense fallback={<Loading />}>
                <TraceDetailPanelAnnotationBar
                  traceNodeId={data.project.trace.id}
                />
              </Suspense>
            ) : selectedSpanNodeId ? (
              <Suspense fallback={<Loading />}>
                <SpanDetails spanNodeId={selectedSpanNodeId} />
              </Suspense>
            ) : null}
          </SpanDetailsWrapper>
        </Panel>
      </Group>
    </main>
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
              <View width="size-3600">
                <RichTokenBreakdown
                  valueLabel="cost"
                  totalValue={costSummary?.total?.cost ?? 0}
                  formatter={costFormatter}
                  segments={[
                    {
                      name: "Prompt",
                      value: costSummary?.prompt?.cost ?? 0,
                      color: "rgba(254, 119, 99, 1)",
                    },
                    {
                      name: "Completion",
                      value: costSummary?.completion?.cost ?? 0,
                      color: "rgba(98, 104, 239, 1)",
                    },
                  ]}
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
        height: 100%;
        overflow: hidden;
      `}
    >
      {children}
    </div>
  );
}
