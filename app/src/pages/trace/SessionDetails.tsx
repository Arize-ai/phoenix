import React, { useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@arizeai/components";

import { TokenCount } from "@phoenix/components/trace/TokenCount";

import {
  SessionDetailsQuery,
  SessionDetailsQuery$data,
} from "./__generated__/SessionDetailsQuery.graphql";
import { SessionDetailsTraceList } from "./SessionDetailsTraceList";

function SessionDetailsHeader({
  traceCount,
  tokenUsage,
}: {
  traceCount: number;
  tokenUsage?: NonNullable<SessionDetailsQuery$data["session"]>["tokenUsage"];
}) {
  return (
    <View
      padding={"size-200"}
      borderBottomWidth={"thin"}
      borderBottomColor={"dark"}
    >
      <Flex direction={"row"} gap={"size-400"}>
        <Flex direction={"column"}>
          <Text elementType={"h3"} textSize={"medium"} color={"text-700"}>
            Traces Count
          </Text>
          <Text textSize={"xlarge"}>{traceCount}</Text>
        </Flex>
        {tokenUsage != null ? (
          <Flex direction={"column"}>
            <Text elementType={"h3"} textSize={"medium"} color={"text-700"}>
              Total Tokens
            </Text>
            <TokenCount
              tokenCountTotal={tokenUsage.total}
              tokenCountCompletion={tokenUsage.completion}
              tokenCountPrompt={tokenUsage.prompt}
              textSize={"xlarge"}
            />
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
      query SessionDetailsQuery($id: GlobalID!) {
        session: node(id: $id) {
          ... on ProjectSession {
            numTraces
            durationS
            tokenUsage {
              total
              completion
              prompt
            }
            sessionId
            sessionUser
            traces {
              edges {
                trace: node {
                  rootSpan {
                    id
                    project {
                      id
                    }
                    input {
                      value
                    }
                    output {
                      value
                    }
                    cumulativeTokenCountTotal
                    cumulativeTokenCountCompletion
                    cumulativeTokenCountPrompt
                    latencyMs
                    startTime
                    spanAnnotations {
                      name
                      label
                      score
                      explanation
                      annotatorKind
                    }
                    context {
                      traceId
                      spanId
                    }
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
      />
      <SessionDetailsTraceList
        traces={data.session.traces}
        user={data.session.sessionUser}
      />
    </main>
  );
}
