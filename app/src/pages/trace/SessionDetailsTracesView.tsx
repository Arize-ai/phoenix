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
  Flex,
  Icon,
  Icons,
  Loading,
  Text,
  Truncate,
  View,
} from "@phoenix/components";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { TraceTreeProvider } from "@phoenix/components/trace/TraceTree";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import type {
  SessionDetailsTracesView_traces$data,
  SessionDetailsTracesView_traces$key,
} from "@phoenix/pages/trace/__generated__/SessionDetailsTracesView_traces.graphql";
import type { SessionDetailsTracesViewTreeQuery } from "@phoenix/pages/trace/__generated__/SessionDetailsTracesViewTreeQuery.graphql";

import { ConnectedTraceTree } from "./ConnectedTraceTree";
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
  /* Bounded height so large traces scroll within the row. */
  height: 400px;
  border-top: 1px solid var(--global-border-color-default);
  background: var(--ac-global-color-grey-75);
`;

/**
 * A rough outline of a sessions traces view.
 *
 * Single-column list of traces. Each row can be expanded to reveal the trace's
 * span tree inline. Selecting a span in the expanded tree updates the
 * `selectedSpanNodeId` URL search param so it can drive a detail view.
 */
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
            height: 100%;
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
                  </Flex>
                </button>
                {isExpanded ? (
                  <div css={traceTreeContainerCSS}>
                    <Suspense fallback={<Loading />}>
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
            <View padding="size-400">
              <Text color="text-700">No traces in this session.</Text>
            </View>
          ) : null}
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
          <View padding="size-400">
            <Text color="text-700">
              Expand a trace and select a span to view its details.
            </Text>
          </View>
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
  if (data.project == null || !("trace" in data.project) || !data.project.trace)
    return null;
  return (
    <TraceTreeProvider>
      <ConnectedTraceTree
        trace={data.project.trace}
        selectedSpanNodeId={selectedSpanNodeId ?? ""}
        onSpanClick={onSpanClick}
      />
    </TraceTreeProvider>
  );
}
