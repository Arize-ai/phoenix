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
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

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
  traceId: string;
  projectId: string;
  preferredTreeWidth: number;
  onPreferredTreeWidthChange: (width: number) => void;
};

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TraceDetails({
  traceId,
  projectId,
  preferredTreeWidth,
  onPreferredTreeWidthChange,
}: TraceDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<TraceDetailsQuery>(
    graphql`
      query TraceDetailsQuery($traceId: ID!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            trace(traceId: $traceId) {
              id
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
    { traceId: traceId as string, id: projectId as string },
    {
      fetchPolicy: "store-and-network",
    }
  );
  invariant(data.project.trace, "Trace is required to view the trace details");
  const gqlSpans = data.project.trace?.rootSpans.edges || [];
  const rootSpans: RootSpan[] = gqlSpans.map((node) => node.span);
  const urlSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  invariant(rootSpans.length > 0, "At least one root must be resolvable");
  const rootSpan = rootSpans[0];
  const selectedSpanNodeId = urlSpanNodeId ?? rootSpan.id;

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
              <TraceTreeToolbar />
              <ConnectedTraceTree
                trace={data.project.trace}
                selectedSpanNodeId={selectedSpanNodeId}
                onSpanClick={(span) => {
                  setSearchParams(
                    (searchParams) => {
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
            {selectedSpanNodeId ? (
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
