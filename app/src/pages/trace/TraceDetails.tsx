import { css } from "@emotion/react";
import type { PropsWithChildren } from "react";
import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useSearchParams } from "react-router";
import invariant from "tiny-invariant";

import { LinkButton, Loading } from "@phoenix/components";
import { CopyButton } from "@phoenix/components/core/copy";
import { InteractiveValue } from "@phoenix/components/core/InteractiveValue";
import { ScopeHeader } from "@phoenix/components/core/ScopeHeader";
import type { ScopeHeaderMetric } from "@phoenix/components/core/ScopeHeader";
import { compactResizeHandleCSS } from "@phoenix/components/resize";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";
import {
  costFormatter,
  formatLatencyMs,
} from "@phoenix/utils/numberFormatUtils";

import type {
  TraceDetailsQuery,
  TraceDetailsQuery$data,
} from "./__generated__/TraceDetailsQuery.graphql";
import { ConnectedTraceTree } from "./ConnectedTraceTree";
import { SpanDetails } from "./SpanDetails";
import { TraceHeaderRootSpanAnnotations } from "./TraceHeaderRootSpanAnnotations";

type RootSpan = NonNullable<
  TraceDetailsQuery$data["project"]["trace"]
>["rootSpans"]["edges"][number]["span"];

type CostSummary = NonNullable<
  TraceDetailsQuery$data["project"]["trace"]
>["costSummary"];

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
      query TraceDetailsQuery($traceId: ID!, $id: ID!) {
        project: node(id: $id) {
          ... on Project {
            trace(traceId: $traceId) {
              projectSessionId
              ...ConnectedTraceTree
              rootSpans: spans(
                first: 1
                rootSpansOnly: true
                orphanSpanAsRootSpan: true
              ) {
                edges {
                  span: node {
                    statusCode
                    id
                    spanId
                    parentId
                  }
                }
              }
              latencyMs
              costSummary {
                prompt {
                  cost
                }
                completion {
                  cost
                }
                total {
                  cost
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
  const traceLatencyMs =
    data.project.trace?.latencyMs != null ? data.project.trace.latencyMs : null;
  const costSummary = data?.project?.trace?.costSummary;
  const rootSpans: RootSpan[] = useMemo(() => {
    const gqlSpans = data.project.trace?.rootSpans.edges || [];
    return gqlSpans.map((node) => node.span);
  }, [data]);
  const urlSpanNodeId = searchParams.get(SELECTED_SPAN_NODE_ID_PARAM);
  invariant(rootSpans.length > 0, "At least one root must be resolvable");
  const rootSpan = rootSpans[0];
  const selectedSpanNodeId = urlSpanNodeId ?? rootSpan.id;
  const sessionId = data.project.trace?.projectSessionId;

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
        traceId={traceId}
        rootSpan={rootSpan}
        latencyMs={traceLatencyMs}
        costSummary={costSummary}
        sessionId={sessionId}
        projectId={projectId}
      />
      <PanelGroup
        direction="horizontal"
        autoSaveId="trace-panel-group"
        css={css`
          flex: 1 1 auto;
          overflow: hidden;
        `}
      >
        <Panel defaultSize={30} minSize={5}>
          <ScrollingPanelContent>
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
          </ScrollingPanelContent>
        </Panel>
        <PanelResizeHandle css={compactResizeHandleCSS} />
        <Panel>
          <ScrollingTabsWrapper>
            {selectedSpanNodeId ? (
              <Suspense fallback={<Loading />}>
                <SpanDetails spanNodeId={selectedSpanNodeId} />
              </Suspense>
            ) : null}
          </ScrollingTabsWrapper>
        </Panel>
      </PanelGroup>
    </main>
  );
}

function TraceHeader({
  traceId,
  rootSpan,
  latencyMs,
  costSummary,
  sessionId,
  projectId,
}: {
  traceId: string;
  rootSpan: RootSpan | null;
  latencyMs: number | null;
  costSummary?: CostSummary | null;
  sessionId?: string | null;
  projectId: string;
}) {
  const { statusCode } = rootSpan ?? { statusCode: "UNSET" };

  const metrics: ScopeHeaderMetric[] = [];
  metrics.push({ label: "Status", value: statusCode });
  if (typeof latencyMs === "number") {
    metrics.push({ label: "Latency", value: formatLatencyMs(latencyMs) });
  }
  if (costSummary?.total?.cost != null) {
    metrics.push({
      label: "Cost",
      value: costFormatter(costSummary.total.cost),
    });
  }

  const extra = (
    <>
      {rootSpan ? (
        <TraceHeaderRootSpanAnnotations spanId={rootSpan.id} />
      ) : null}
      {sessionId && (
        <LinkButton
          size="S"
          variant="primary"
          to={`/projects/${projectId}/sessions/${sessionId}`}
        >
          View Session
        </LinkButton>
      )}
    </>
  );

  return (
    <ScopeHeader
      name={rootSpan ? `Trace` : "Trace"}
      statusIndicator={<SpanStatusCodeIcon statusCode={statusCode} />}
      referenceId={
        <>
          <InteractiveValue>{traceId}</InteractiveValue>
          <CopyButton text={traceId} variant="quiet" size="S" />
        </>
      }
      metrics={metrics}
      extra={extra}
    />
  );
}

function ScrollingTabsWrapper({ children }: PropsWithChildren) {
  return (
    <div
      data-testid="scrolling-tabs-wrapper"
      css={css`
        height: 100%;
        overflow: hidden;
        .tabs {
          height: 100%;
          overflow: hidden;
          .tabs__extra {
            width: 100%;
            padding-right: var(--global-dimension-size-200);
            padding-bottom: var(--global-dimension-size-50);
          }
          .tabs__pane-container {
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
