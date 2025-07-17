import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import {
  Flex,
  RichTooltip,
  Text,
  TooltipTrigger,
  TriggerWrap,
  View,
} from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SessionTokenCount } from "@phoenix/components/trace/SessionTokenCount";
import { SESSION_DETAILS_PAGE_SIZE } from "@phoenix/pages/trace/constants";

import { costFormatter } from "../../utils/numberFormatUtils";

import {
  SessionDetailsQuery,
  SessionDetailsQuery$data,
} from "./__generated__/SessionDetailsQuery.graphql";
import { SessionDetailsTraceList } from "./SessionDetailsTraceList";

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
      borderBottomColor={"dark"}
    >
      <Flex direction={"row"} gap={"size-400"}>
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
        traceCount={data.session.numTraces ?? 0}
        costSummary={data.session.costSummary}
        tokenUsage={data.session.tokenUsage}
        latencyP50={data.session.latencyP50}
        sessionId={sessionId}
      />
      <SessionDetailsTraceList tracesRef={data.session} />
    </main>
  );
}
