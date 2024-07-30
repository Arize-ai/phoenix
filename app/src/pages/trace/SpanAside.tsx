import React, { PropsWithChildren, useMemo } from "react";
import { graphql, useRefetchableFragment } from "react-relay";

import { Flex, Text, View } from "@arizeai/components";

import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { useSpanStatusCodeColor } from "@phoenix/components/trace/useSpanStatusCodeColor";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { SpanAside_span$key } from "./__generated__/SpanAside_span.graphql";
import { SpanAsideSpanQuery } from "./__generated__/SpanAsideSpanQuery.graphql";

/**
 *
 * @returns
 */
export function SpanAside(props: { span: SpanAside_span$key }) {
  const [data] = useRefetchableFragment<SpanAsideSpanQuery, SpanAside_span$key>(
    graphql`
      fragment SpanAside_span on Span
      @refetchable(queryName: "SpanAsideSpanQuery") {
        id
        code: statusCode
        startTime
        endTime
        tokenCountTotal
        tokenCountPrompt
        tokenCountCompletion
      }
    `,
    props.span
  );
  const {
    startTime,
    endTime,
    code,
    tokenCountCompletion,
    tokenCountPrompt,
    tokenCountTotal,
  } = data;
  const startDate = useMemo(() => new Date(startTime), [startTime]);
  const endDate = useMemo(
    () => (endTime ? new Date(endTime) : null),
    [endTime]
  );
  const latencyMs = useMemo(() => {
    if (!endDate) return null;
    return endDate.getTime() - startDate.getTime();
  }, [endDate, startDate]);
  const statusColor = useSpanStatusCodeColor(code);
  return (
    <View
      padding="size-200"
      borderColor="dark"
      backgroundColor="light"
      borderLeftWidth="thin"
      width="210px"
      flex="none"
      minHeight="100%"
    >
      <Flex direction="column" gap="size-200">
        <LabeledValue label="Status">
          <Flex direction="row" gap="size-50" alignItems="center">
            <SpanStatusCodeIcon statusCode={code} />
            <Text textSize="xlarge" color={statusColor}>
              {code}
            </Text>
          </Flex>
        </LabeledValue>
        <LabeledValue label="Start Time">
          <Text textSize="xlarge">{fullTimeFormatter(startDate)}</Text>
        </LabeledValue>
        {endDate && (
          <LabeledValue label="End Time">
            <Text textSize="xlarge">{fullTimeFormatter(endDate)}</Text>
          </LabeledValue>
        )}
        <LabeledValue label="Latency">
          <Text textSize="xlarge">
            {typeof latencyMs === "number" ? (
              <LatencyText latencyMs={latencyMs} textSize="xlarge" />
            ) : (
              "--"
            )}
          </Text>
        </LabeledValue>
        {tokenCountTotal ? (
          <LabeledValue label="Total Tokens" key="tokens">
            <TokenCount
              tokenCountTotal={tokenCountTotal}
              tokenCountPrompt={tokenCountPrompt ?? 0}
              tokenCountCompletion={tokenCountCompletion ?? 0}
              textSize="xlarge"
            />
          </LabeledValue>
        ) : null}
      </Flex>
    </View>
  );
}

function LabeledValue({
  label,
  children,
}: PropsWithChildren<{ label: string }>) {
  return (
    <Flex direction="column">
      <Text elementType="h3" textSize="medium" color="text-700">
        {label}
      </Text>
      {children}
    </Flex>
  );
}
