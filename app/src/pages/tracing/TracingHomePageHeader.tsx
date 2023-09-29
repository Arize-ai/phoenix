import React from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, Text, View } from "@arizeai/components";

import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { TracingHomePageHeader_stats$key } from "./__generated__/TracingHomePageHeader_stats.graphql";

export function TracingHomePageHeader(props: {
  query: TracingHomePageHeader_stats$key;
}) {
  const data = useFragment<TracingHomePageHeader_stats$key>(
    graphql`
      fragment TracingHomePageHeader_stats on Query {
        totalTraces: spans(rootSpansOnly: true) {
          pageInfo {
            totalCount
          }
        }
        traceDatasetInfo {
          startTime
          endTime
          tokenCountTotal
          latencyMsP50
          latencyMsP99
        }
      }
    `,
    props.query
  );
  const latencyMsP50 = data?.traceDatasetInfo?.latencyMsP50;
  const latencyMsP99 = data?.traceDatasetInfo?.latencyMsP99;
  const tokenCountTotal = data?.traceDatasetInfo?.tokenCountTotal;
  return (
    <View
      paddingStart="size-200"
      paddingEnd="size-200"
      paddingTop="size-100"
      paddingBottom="size-50"
      flex="none"
    >
      <Flex direction="row" gap="size-400" alignItems="center">
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="white70">
            Total Traces
          </Text>
          <Text textSize="xlarge">
            {intFormatter(data?.totalTraces.pageInfo.totalCount)}
          </Text>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="white70">
            Total Tokens
          </Text>
          <Text textSize="xlarge">{intFormatter(tokenCountTotal)}</Text>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="white70">
            Latency P50 yo
          </Text>
          {latencyMsP50 != null ? (
            <LatencyText latencyMs={latencyMsP50} textSize="xlarge" />
          ) : (
            <Text textSize="xlarge">--</Text>
          )}
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="white70">
            Latency P99
          </Text>

          {latencyMsP99 != null ? (
            <LatencyText latencyMs={latencyMsP99} textSize="xlarge" />
          ) : (
            <Text textSize="xlarge">--</Text>
          )}
        </Flex>
      </Flex>
    </View>
  );
}
