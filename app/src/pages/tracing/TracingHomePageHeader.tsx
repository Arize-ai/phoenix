import React from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, Text, View } from "@arizeai/components";

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
        }
      }
    `,
    props.query
  );
  const startTime = data?.traceDatasetInfo?.startTime;
  const endTime = data?.traceDatasetInfo?.endTime;
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
            Start
          </Text>
          <Text textSize="xlarge">
            {startTime != null
              ? new Date(startTime).toLocaleString([], {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--"}
          </Text>
        </Flex>
        <Flex direction="column">
          <Text elementType="h3" textSize="medium" color="white70">
            End
          </Text>
          <Text textSize="xlarge">
            {endTime != null
              ? new Date(endTime).toLocaleString([], {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "--"}
          </Text>
        </Flex>
      </Flex>
    </View>
  );
}
