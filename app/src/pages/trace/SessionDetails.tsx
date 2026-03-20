import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import { CopyButton } from "@phoenix/components/core/copy";
import { InteractiveValue } from "@phoenix/components/core/InteractiveValue";
import { ScopeHeader } from "@phoenix/components/core/ScopeHeader";
import type { ScopeHeaderMetric } from "@phoenix/components/core/ScopeHeader";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";
import {
  costFormatter,
  formatLatencyMs,
} from "@phoenix/utils/numberFormatUtils";

import type {
  SessionDetailsQuery,
  SessionDetailsQuery$data,
} from "./__generated__/SessionDetailsQuery.graphql";
import { SessionDetailsTraceList } from "./SessionDetailsTraceList";

export type SessionDetailsProps = {
  sessionId: string;
};

/**
 * A component that shows the details of a session
 */
export function SessionDetails(props: SessionDetailsProps) {
  const { sessionId } = props;
  const data = useLazyLoadQuery<SessionDetailsQuery>(
    graphql`
      query SessionDetailsQuery($id: ID!, $first: Int) {
        session: node(id: $id) {
          ... on ProjectSession {
            numTraces
            tokenUsage {
              total
            }
            costSummary {
              total {
                cost
                tokens
              }
              prompt {
                cost
                tokens
              }
              completion {
                cost
                tokens
              }
            }
            sessionId
            latencyP50: traceLatencyMsQuantile(probability: 0.50)
            ...SessionDetailsTraceList_traces @arguments(first: $first)
          }
        }
      }
    `,
    {
      id: sessionId,
      first: SESSION_DETAILS_PAGE_SIZE,
    },
    {
      fetchPolicy: "store-and-network",
    }
  );

  if (data.session == null) {
    throw new Error("Session not found");
  }

  const displaySessionId = data.session.sessionId ?? "--";
  const metrics = buildSessionMetrics({
    traceCount: data.session.numTraces ?? 0,
    tokenUsage: data.session.tokenUsage,
    costSummary: data.session.costSummary,
    latencyP50: data.session.latencyP50,
  });

  return (
    <main
      css={css`
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      `}
    >
      <ScopeHeader
        name="Session"
        referenceId={
          <>
            <InteractiveValue>{displaySessionId}</InteractiveValue>
            <CopyButton text={displaySessionId} variant="quiet" size="S" />
          </>
        }
        metrics={metrics}
      />
      <SessionDetailsTraceList tracesRef={data.session} />
    </main>
  );
}

function buildSessionMetrics({
  traceCount,
  tokenUsage,
  costSummary,
  latencyP50,
}: {
  traceCount: number;
  tokenUsage?: NonNullable<SessionDetailsQuery$data["session"]>["tokenUsage"];
  costSummary?: NonNullable<SessionDetailsQuery$data["session"]>["costSummary"];
  latencyP50?: number | null;
}): ScopeHeaderMetric[] {
  const metrics: ScopeHeaderMetric[] = [
    { label: "Traces", value: String(traceCount) },
  ];
  if (tokenUsage?.total != null) {
    metrics.push({
      label: "Tokens",
      value: tokenUsage.total.toLocaleString(),
    });
  }
  if (costSummary?.total?.cost != null) {
    metrics.push({
      label: "Cost",
      value: costFormatter(costSummary.total.cost),
    });
  }
  if (latencyP50 != null) {
    metrics.push({
      label: "P50 Latency",
      value: formatLatencyMs(latencyP50),
    });
  }
  return metrics;
}
