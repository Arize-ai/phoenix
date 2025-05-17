import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { TokenCount } from "@phoenix/components/trace/TokenCount";

import {
  SessionDetailsQuery,
  SessionDetailsQuery$data,
} from "./__generated__/SessionDetailsQuery.graphql";
import { SessionDetailsTraceList } from "./SessionDetailsTraceList";

function SessionDetailsHeader({
  traceCount,
  tokenUsage,
  latencyP50,
}: {
  traceCount: number;
  tokenUsage?: NonNullable<SessionDetailsQuery$data["session"]>["tokenUsage"];
  latencyP50?: number | null;
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
            <TokenCount
              tokenCountTotal={tokenUsage.total}
              tokenCountCompletion={tokenUsage.completion}
              tokenCountPrompt={tokenUsage.prompt}
              size="L"
            />
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
      query SessionDetailsQuery($id: ID!) {
        session: node(id: $id) {
          ... on ProjectSession {
            numTraces
            tokenUsage {
              total
              completion
              prompt
            }
            sessionId
            latencyP50: traceLatencyMsQuantile(probability: 0.50)
            traces {
              edges {
                trace: node {
                  id
                  traceId
                  rootSpan {
                    id
                    attributes
                    project {
                      id
                    }
                    input {
                      value
                      mimeType
                    }
                    output {
                      value
                      mimeType
                    }
                    cumulativeTokenCountTotal
                    cumulativeTokenCountCompletion
                    cumulativeTokenCountPrompt
                    latencyMs
                    startTime
                    spanId
                    ...AnnotationSummaryGroup
                  }
                }
              }
            }
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
        tokenUsage={data.session.tokenUsage}
        latencyP50={data.session.latencyP50}
      />
      <SessionDetailsTraceList traces={data.session.traces} />
    </main>
  );
}
