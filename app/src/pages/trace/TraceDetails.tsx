import React, { PropsWithChildren, Suspense, useEffect, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useParams, useSearchParams } from "react-router-dom";
import { css } from "@emotion/react";

import {
  Flex,
  Icon,
  Icons,
  Link,
  Loading,
  Text,
  View,
} from "@phoenix/components";
import { resizeHandleCSS } from "@phoenix/components/resize";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TraceTree } from "@phoenix/components/trace/TraceTree";
import { useSpanStatusCodeColor } from "@phoenix/components/trace/useSpanStatusCodeColor";

import {
  TraceDetailsQuery,
  TraceDetailsQuery$data,
} from "./__generated__/TraceDetailsQuery.graphql";
import { SpanDetails } from "./SpanDetails";
import { TraceHeaderRootSpanAnnotations } from "./TraceHeaderRootSpanAnnotations";

export const SELECTED_SPAN_NODE_ID_URL_PARAM = "selectedSpanNodeId";

type Span = NonNullable<
  TraceDetailsQuery$data["project"]["trace"]
>["spans"]["edges"][number]["span"];

/**
 * A root span is defined to be a span whose parent span is not in our collection.
 * But if more than one such span exists, return null.
 */
function findRootSpan(spansList: Span[]): Span | null {
  // If there is a span whose parent is null, then it is the root span.
  const rootSpan = spansList.find((span) => span.parentId == null);
  if (rootSpan) return rootSpan;
  // Otherwise we need to find all spans whose parent span is not in our collection.
  const spanIds = new Set(spansList.map((span) => span.context.spanId));
  const rootSpans = spansList.filter(
    (span) => span.parentId != null && !spanIds.has(span.parentId)
  );
  // If only one such span exists, then return it, otherwise, return null.
  if (rootSpans.length === 1) return rootSpans[0];
  return null;
}

export type TraceDetailsProps = {
  traceId: string;
  projectId: string;
};

/**
 * A component that shows the details of a trace (e.g. a collection of spans)
 */
export function TraceDetails(props: TraceDetailsProps) {
  const { traceId, projectId } = props;
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useLazyLoadQuery<TraceDetailsQuery>(
    graphql`
      query TraceDetailsQuery($traceId: ID!, $id: GlobalID!) {
        project: node(id: $id) {
          ... on Project {
            trace(traceId: $traceId) {
              projectSessionId
              spans(first: 1000) {
                edges {
                  span: node {
                    id
                    context {
                      spanId
                      traceId
                    }
                    name
                    spanKind
                    statusCode: propagatedStatusCode
                    startTime
                    parentId
                    latencyMs
                    tokenCountTotal
                    tokenCountPrompt
                    tokenCountCompletion
                  }
                }
              }
              latencyMs
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
  const traceLatencyMs =
    data.project.trace?.latencyMs != null ? data.project.trace.latencyMs : null;
  const spansList: Span[] = useMemo(() => {
    const gqlSpans = data.project.trace?.spans.edges || [];
    return gqlSpans.map((node) => node.span);
  }, [data]);
  const urlSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_URL_PARAM);
  const selectedSpanNodeId = urlSpanNodeId ?? spansList[0].id;
  const rootSpan = useMemo(() => findRootSpan(spansList), [spansList]);

  // Clear the selected span param when the component unmounts
  useEffect(() => {
    return () => {
      setSearchParams(
        (searchParams) => {
          searchParams.delete(SELECTED_SPAN_NODE_ID_URL_PARAM);
          return searchParams;
        },
        { replace: true }
      );
    };
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <main
      css={css`
        flex: 1 1 auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      `}
    >
      <TraceHeader
        rootSpan={rootSpan}
        latencyMs={traceLatencyMs}
        sessionId={data.project.trace?.projectSessionId}
      />
      <PanelGroup
        direction="horizontal"
        autoSaveId="trace-panel-group"
        css={css`
          flex: 1 1 auto;
          overflow: hidden;
        `}
      >
        <Panel defaultSize={30} minSize={10} maxSize={70}>
          <ScrollingPanelContent>
            <TraceTree
              spans={spansList}
              selectedSpanNodeId={selectedSpanNodeId}
              onSpanClick={(span) => {
                setSearchParams(
                  (searchParams) => {
                    searchParams.set(SELECTED_SPAN_NODE_ID_URL_PARAM, span.id);
                    return searchParams;
                  },
                  { replace: true }
                );
              }}
            />
          </ScrollingPanelContent>
        </Panel>
        <PanelResizeHandle css={resizeHandleCSS} />
        <Panel>
          <ScrollingTabsWrapper>
            {selectedSpanNodeId ? (
              <Suspense fallback={<Loading />}>
                <SpanDetails
                  spanNodeId={selectedSpanNodeId}
                  projectId={projectId}
                />
              </Suspense>
            ) : null}
          </ScrollingTabsWrapper>
        </Panel>
      </PanelGroup>
    </main>
  );
}

function TraceHeader({
  rootSpan,
  latencyMs,
  sessionId,
}: {
  rootSpan: Span | null;
  latencyMs: number | null;
  sessionId?: string | null;
}) {
  const { projectId } = useParams();
  const { statusCode } = rootSpan ?? {
    statusCode: "UNSET",
  };
  const statusColor = useSpanStatusCodeColor(statusCode);
  return (
    <View padding="size-200" borderBottomWidth="thin" borderBottomColor="dark">
      <Flex direction="row" gap="size-400" alignItems={"center"}>
        <Flex direction="column">
          <Text elementType="h3" size="M" color="text-700">
            Trace Status
          </Text>
          <Text size="XL">
            <Flex direction="row" gap="size-50" alignItems="center">
              <SpanStatusCodeIcon statusCode={statusCode} />
              <Text size="L" color={statusColor}>
                {statusCode}
              </Text>
            </Flex>
          </Text>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" size="M" color="text-700">
            Latency
          </Text>
          <Text size="XL">
            {typeof latencyMs === "number" ? (
              <LatencyText latencyMs={latencyMs} size="L" />
            ) : (
              "--"
            )}
          </Text>
        </Flex>
        {rootSpan ? TraceHeaderRootSpanAnnotations(rootSpan.id) : null}
        {sessionId && (
          <span
            css={css`
              margin-left: auto;
            `}
          >
            <Link to={`/projects/${projectId}/sessions/${sessionId}`}>
              <Flex alignItems={"center"}>
                View Session <Icon svg={<Icons.ArrowIosForwardOutline />} />
              </Flex>
            </Link>
          </span>
        )}
      </Flex>
    </View>
  );
}

function ScrollingTabsWrapper({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="scrolling-tabs-wrapper"
      css={css`
        height: 100%;
        overflow: hidden;
        .ac-tabs {
          height: 100%;
          overflow: hidden;
          .ac-tabs__extra {
            width: 100%;
            padding-right: var(--ac-global-dimension-size-200);
            padding-bottom: var(--ac-global-dimension-size-50);
          }
          .ac-tabs__pane-container {
            min-height: 100%;
            height: 100%;
            overflow-y: auto;
            div[role="tabpanel"] {
              height: 100%;
            }
          }
        }
      `}
    >
      {children}
    </div>
  );
}

function ScrollingPanelContent({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="scrolling-panel-content"
      css={css`
        height: 100%;
        overflow-y: auto;
      `}
    >
      {children}
    </div>
  );
}
