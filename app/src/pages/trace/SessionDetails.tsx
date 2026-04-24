import { css } from "@emotion/react";
import { Suspense, useEffect, useState, useTransition } from "react";
import { graphql, useLazyLoadQuery, useQueryLoader } from "react-relay";

import {
  Flex,
  Loading,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SessionTokenCount } from "@phoenix/components/trace/SessionTokenCount";
import { useFeatureFlag } from "@phoenix/contexts/FeatureFlagsContext";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import { costFormatter } from "../../utils/numberFormatUtils";
import type {
  SessionDetailsQuery,
  SessionDetailsQuery$data,
} from "./__generated__/SessionDetailsQuery.graphql";
import type { SessionDetailsTraceListQuery } from "./__generated__/SessionDetailsTraceListQuery.graphql";
import type { SessionDetailsTracesViewQuery } from "./__generated__/SessionDetailsTracesViewQuery.graphql";
import {
  SessionDetailsTraceList,
  sessionDetailsTraceListQuery,
} from "./SessionDetailsTraceList";
import {
  SessionDetailsTracesView,
  sessionDetailsTracesViewQuery,
} from "./SessionDetailsTracesView";
import type { SessionView } from "./SessionViewTabs";

function SessionDetailsHeader({
  traceCount,
  costSummary,
  tokenUsage,
  latencyP50,
  sessionId,
}: {
  traceCount: number;
  tokenUsage?: NonNullable<SessionDetailsQuery$data["session"]>["tokenUsage"];
  costSummary?: NonNullable<SessionDetailsQuery$data["session"]>["costSummary"];
  latencyP50?: number | null;
  sessionId: string;
}) {
  return (
    <View
      padding="size-200"
      borderBottomWidth={"thin"}
      borderBottomColor="default"
    >
      <Flex direction="row" gap="size-400" alignItems="center">
        <Flex direction={"column"}>
          <Text elementType={"h3"} color={"text-700"}>
            Traces Count
          </Text>
          <Text size="L">{traceCount}</Text>
        </Flex>
        {tokenUsage != null ? (
          <Flex direction={"column"}>
            <Text elementType={"h3"} color={"text-700"}>
              Total Tokens
            </Text>
            <SessionTokenCount
              tokenCountTotal={tokenUsage.total}
              nodeId={sessionId}
              size="L"
            />
          </Flex>
        ) : null}
        {costSummary != null ? (
          <Flex direction="column" flex="none">
            <Text elementType="h3" size="S" color="text-700">
              Total Cost
            </Text>
            <TooltipTrigger delay={0}>
              <TriggerWrap>
                <Text size="L">
                  {costFormatter(costSummary.total?.cost ?? 0)}
                </Text>
              </TriggerWrap>
              <RichTooltip placement="bottom">
                <View width="size-2400">
                  <Flex direction="column">
                    <Flex justifyContent="space-between">
                      <Text>Prompt Cost</Text>
                      <Text>
                        {costFormatter(costSummary.prompt?.cost ?? 0)}
                      </Text>
                    </Flex>
                    <Flex justifyContent="space-between">
                      <Text>Completion Cost</Text>
                      <Text>
                        {costFormatter(costSummary.completion?.cost ?? 0)}
                      </Text>
                    </Flex>
                    <Flex justifyContent="space-between">
                      <Text>Total Cost</Text>
                      <Text>{costFormatter(costSummary.total?.cost ?? 0)}</Text>
                    </Flex>
                  </Flex>
                </View>
              </RichTooltip>
            </TooltipTrigger>
          </Flex>
        ) : null}
        {latencyP50 != null ? (
          <Flex direction={"column"}>
            <Text elementType={"h3"} color={"text-700"}>
              Latency P50
            </Text>
            <LatencyText latencyMs={latencyP50} size="L" />
          </Flex>
        ) : null}
      </Flex>
    </View>
  );
}

export type SessionDetailsProps = {
  sessionId: string;
};

/**
 * A component that shows the details of a session
 */
export function SessionDetails(props: SessionDetailsProps) {
  const { sessionId } = props;
  const sessionsUXEnabled = useFeatureFlag("sessions_ux");
  const [sessionView, setSessionView] = useState<SessionView>("turns");
  const data = useLazyLoadQuery<SessionDetailsQuery>(
    graphql`
      query SessionDetailsQuery($id: ID!) {
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
          }
        }
      }
    `,
    {
      id: sessionId,
    },
    {
      fetchPolicy: "store-and-network",
    }
  );

  if (data.session == null) {
    throw new Error("Session not found");
  }
  const traceCount = data.session.numTraces ?? 0;
  const showTracesView = sessionsUXEnabled && sessionView === "traces";

  const [traceListQueryRef, loadTraceListQuery] =
    useQueryLoader<SessionDetailsTraceListQuery>(sessionDetailsTraceListQuery);
  const [tracesViewQueryRef, loadTracesViewQuery] =
    useQueryLoader<SessionDetailsTracesViewQuery>(sessionDetailsTracesViewQuery);
  const [, startViewTransition] = useTransition();

  // Load the initial view's query on mount. View switches load their query
  // inside startTransition (see handleSessionViewChange) so the previous
  // view stays mounted while the next one fetches, avoiding a fallback flash.
  useEffect(() => {
    if (showTracesView) {
      loadTracesViewQuery({
        id: sessionId,
        first: SESSION_DETAILS_PAGE_SIZE,
      });
    } else {
      loadTraceListQuery({
        id: sessionId,
        first: SESSION_DETAILS_PAGE_SIZE,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const handleSessionViewChange = (view: SessionView) => {
    startViewTransition(() => {
      if (view === "traces") {
        loadTracesViewQuery({
          id: sessionId,
          first: SESSION_DETAILS_PAGE_SIZE,
        });
      } else {
        loadTraceListQuery({
          id: sessionId,
          first: SESSION_DETAILS_PAGE_SIZE,
        });
      }
      setSessionView(view);
    });
  };

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
      <SessionDetailsHeader
        traceCount={traceCount}
        costSummary={data.session.costSummary}
        tokenUsage={data.session.tokenUsage}
        latencyP50={data.session.latencyP50}
        sessionId={sessionId}
      />
      <Suspense fallback={<Loading />}>
        {showTracesView
          ? tracesViewQueryRef != null && (
              <SessionDetailsTracesView
                queryRef={tracesViewQueryRef}
                sessionView={sessionView}
                onSessionViewChange={handleSessionViewChange}
                traceCount={traceCount}
              />
            )
          : traceListQueryRef != null && (
              <SessionDetailsTraceList
                queryRef={traceListQueryRef}
                sessionView={sessionView}
                onSessionViewChange={handleSessionViewChange}
                showSessionViewTabs={sessionsUXEnabled}
                traceCount={traceCount}
              />
            )}
      </Suspense>
    </main>
  );
}
