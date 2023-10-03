import React, { useCallback, useState } from "react";
import { graphql, useFragment } from "react-relay";

import { Button, Flex, Icon, Icons, Text, View } from "@arizeai/components";

import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { useInterval } from "@phoenix/hooks/useInterval";
import { intFormatter } from "@phoenix/utils/numberFormatUtils";

import { TracingHomePageHeader_stats$key } from "./__generated__/TracingHomePageHeader_stats.graphql";

const REFRESH_INTERVAL_MS = 10000;
export function TracingHomePageHeader(props: {
  query: TracingHomePageHeader_stats$key;
  /**
   * A callback to call to refetch the page data.
   */
  onRefresh: () => void;
}) {
  const { onRefresh } = props;
  const [isRefetchEnabled, setIsRefetchEnabled] = useState<boolean>(true);
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
  const refetchIfEnabled = useCallback(() => {
    if (isRefetchEnabled) {
      onRefresh();
    }
  }, [isRefetchEnabled, onRefresh]);

  useInterval(refetchIfEnabled, REFRESH_INTERVAL_MS);
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
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <Flex direction="row" gap="size-400" alignItems="center">
          <Flex direction="column">
            <Text elementType="h3" textSize="medium" color="text-700">
              Total Traces
            </Text>
            <Text textSize="xlarge">
              {intFormatter(data?.totalTraces.pageInfo.totalCount)}
            </Text>
          </Flex>
          <Flex direction="column">
            <Text elementType="h3" textSize="medium" color="text-700">
              Total Tokens
            </Text>
            <Text textSize="xlarge">{intFormatter(tokenCountTotal)}</Text>
          </Flex>
          <Flex direction="column">
            <Text elementType="h3" textSize="medium" color="text-700">
              Latency P50
            </Text>
            {latencyMsP50 != null ? (
              <LatencyText latencyMs={latencyMsP50} textSize="xlarge" />
            ) : (
              <Text textSize="xlarge">--</Text>
            )}
          </Flex>
          <Flex direction="column">
            <Text elementType="h3" textSize="medium" color="text-700">
              Latency P99
            </Text>

            {latencyMsP99 != null ? (
              <LatencyText latencyMs={latencyMsP99} textSize="xlarge" />
            ) : (
              <Text textSize="xlarge">--</Text>
            )}
          </Flex>
        </Flex>
        <Button
          variant="default"
          icon={
            <Icon
              svg={
                isRefetchEnabled ? (
                  <Icons.LoadingOutline />
                ) : (
                  <Icons.PauseCircle />
                )
              }
            />
          }
          onClick={() => {
            setIsRefetchEnabled(!isRefetchEnabled);
            onRefresh();
          }}
        >
          {isRefetchEnabled ? "Streaming" : "Paused"}
        </Button>
      </Flex>
    </View>
  );
}
