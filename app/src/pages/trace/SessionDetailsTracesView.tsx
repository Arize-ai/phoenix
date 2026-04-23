import { css } from "@emotion/react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery, usePaginationFragment } from "react-relay";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
} from "react-resizable-panels";
import { useSearchParams } from "react-router";

import {
  Counter,
  Empty,
  Flex,
  Heading,
  Icon,
  Icons,
  Loading,
  Text,
  Truncate,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCosts } from "@phoenix/components/trace/TokenCosts";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { TraceTreeSkeleton } from "@phoenix/components/trace/TraceTreeSkeleton";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import type {
  SessionDetailsTracesView_traces$data,
  SessionDetailsTracesView_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTracesView_traces.graphql";
import type { SessionDetailsTracesViewTreeQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewTreeQuery.graphql";

import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { sessionPanelHeaderCSS } from "./SessionDetailsTraceList";
import { SpanDetails } from "./SpanDetails";

type SessionTraceRow = NonNullable<
  SessionDetailsTracesView_traces$data["traces"]["edges"][number]["trace"]
> & {
  rootSpan: NonNullable<
    SessionDetailsTracesView_traces$data["traces"]["edges"][number]["trace"]["rootSpan"]
  >;
};

const traceRowCSS = css`
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--global-border-color-default);
`;

const traceRowHeaderCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-static-size-200);
  padding: var(--global-dimension-static-size-200);
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:hover {
    background: var(--global-list-item-hover-background-color);
  }
`;

const chevronCSS = css`
  flex: none;
  transition: transform 120ms ease;
  display: inline-flex;

  &[data-expanded="true"] {
    transform: rotate(90deg);
  }
`;

const traceTreeContainerCSS = css`
  /* Let the tree size to its content but cap overflow so large traces
     scroll within the row rather than pushing the list offscreen. */
  max-height: 500px;
  overflow: auto;
  border-top: 1px solid var(--global-border-color-default);
  background: var(--ac-global-color-grey-75);
`;

export function SessionDetailsTracesView({
  tracesRef,
}: {
  tracesRef: SessionDetailsTracesView_traces$key;
}) {
  const { data } = usePaginationFragment(
    graphql`
      fragment SessionDetailsTracesView_traces on ProjectSession
      @refetchable(queryName: "SessionDetailsTracesViewRefetchQuery")
      @argumentDefinitions(
        first: { type: "Int", defaultValue: 50 }
        after: { type: "String", defaultValue: null }
      ) {
        numTraces
        traces(first: $first, after: $after)
          @connection(key: "SessionDetailsTracesView_traces") {
          edges {
            trace: node {
              id
              traceId
              rootSpan {
                id
                name
                cumulativeTokenCountTotal
                latencyMs
                project {
                  id
                }
                trace {
                  id
                  costSummary {
                    total {
                      cost
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    tracesRef
  );

  const traces: SessionTraceRow[] = (data.traces?.edges ?? [])
    .map(({ trace }) => trace)
    .filter(
      (t): t is SessionTraceRow =>
        t != null && t.rootSpan != null && t.rootSpan.project != null
    );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSpanClick = (span: { id: string }) => {
    setSearchParams(
      (params) => {
        params.set(SELECTED_SPAN_NODE_ID_PARAM, span.id);
        return params;
      },
      { replace: true }
    );
  };

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "session-traces-view-layout",
    storage: localStorage,
  });

  return (
    <Group
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
      css={css`
        flex: 1 1 auto;
        overflow: hidden;
      `}
    >
      <Panel id="session-traces-list" defaultSize="50%" minSize="20%">
        <div
          css={css`
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
          `}
        >
          <div css={sessionPanelHeaderCSS}>
            <Heading level={3}>Traces</Heading>
            <Counter variant="quiet">{data.numTraces ?? traces.length}</Counter>
          </div>
          <div
            css={css`
              flex: 1 1 auto;
              min-height: 0;
              overflow: auto;
            `}
          >
            {traces.map((trace, index) => {
              const isExpanded = expandedIds.has(trace.id);
              const paddedIndex = String(index + 1).padStart(2, "0");
              return (
                <div key={trace.id} css={traceRowCSS}>
                  <button
                    type="button"
                    css={traceRowHeaderCSS}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(trace.id)}
                  >
                    <span css={chevronCSS} data-expanded={isExpanded}>
                      <Icon svg={<Icons.ChevronRight />} />
                    </span>
                    <Text fontFamily="mono" color="text-500">
                      {paddedIndex}
                    </Text>
                    <Flex flex={1} minWidth={0}>
                      <Truncate maxWidth="100%" title={trace.rootSpan.name}>
                        <Text weight="heavy">{trace.rootSpan.name}</Text>
                      </Truncate>
                    </Flex>
                    <Flex
                      direction="row"
                      gap="size-100"
                      alignItems="center"
                      flex="none"
                    >
                      <TokenCount size="S">
                        {trace.rootSpan.cumulativeTokenCountTotal ?? 0}
                      </TokenCount>
                      {trace.rootSpan.latencyMs != null ? (
                        <LatencyText
                          latencyMs={trace.rootSpan.latencyMs}
                          size="S"
                        />
                      ) : null}
                      {trace.rootSpan.trace.costSummary?.total?.cost !=
                      null ? (
                        <TokenCosts size="S">
                          {trace.rootSpan.trace.costSummary.total.cost}
                        </TokenCosts>
                      ) : null}
                    </Flex>
                  </button>
                  {isExpanded ? (
                    <div css={traceTreeContainerCSS}>
                      <Suspense fallback={<TraceTreeSkeleton />}>
                        <LazyTraceTree
                          traceId={trace.traceId}
                          projectId={trace.rootSpan.project.id}
                          selectedSpanNodeId={selectedSpanNodeId}
                          onSpanClick={handleSpanClick}
                        />
                      </Suspense>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {traces.length === 0 ? (
              <Empty message="No traces in this session" />
            ) : null}
          </div>
        </div>
      </Panel>
      <Separator css={compactResizeHandleCSS} />
      <Panel id="session-traces-span-details">
        {selectedSpanNodeId ? (
          <div
            css={css`
              height: 100%;
              overflow: auto;
            `}
          >
            <Suspense fallback={<Loading />}>
              <SpanDetails
                key={selectedSpanNodeId}
                spanNodeId={selectedSpanNodeId}
              />
            </Suspense>
          </div>
        ) : (
          <div
            css={css`
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
            `}
          >
            <Empty message="Expand a trace and select a span to view its details" />
          </div>
        )}
      </Panel>
    </Group>
  );
}

function LazyTraceTree({
  traceId,
  projectId,
  selectedSpanNodeId,
  onSpanClick,
}: {
  traceId: string;
  projectId: string;
  selectedSpanNodeId: string | null;
  onSpanClick: (span: { id: string }) => void;
}) {
  const data = useLazyLoadQuery<SessionDetailsTracesViewTreeQuery>(
    graphql`
      query SessionDetailsTracesViewTreeQuery($traceId: ID!, $projectId: ID!) {
        project: node(id: $projectId) {
          ... on Project {
            trace(traceId: $traceId) {
              ...ConnectedTraceTree
            }
          }
        }
      }
    `,
    { traceId, projectId }
  );
  const trace = data.project?.trace;
  if (!trace) return null;
  return (
    <TraceTreeProvider>
      <ConnectedTraceTree
        trace={trace}
        selectedSpanNodeId={selectedSpanNodeId ?? ""}
        onSpanClick={onSpanClick}
      />
    </TraceTreeProvider>
  );
}
