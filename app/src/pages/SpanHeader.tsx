import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Text } from "@phoenix/components";
import { LatencyText } from "@phoenix/components/trace/LatencyText";
import { SpanKindToken } from "@phoenix/components/trace/SpanKindToken";
import { SpanStatusCodeIcon } from "@phoenix/components/trace/SpanStatusCodeIcon";
import { TokenCount } from "@phoenix/components/trace/TokenCount";
import { fullTimeFormatter } from "@phoenix/utils/timeFormatUtils";

import { SpanHeader_span$key } from "./__generated__/SpanHeader_span.graphql";

type SpanHeaderProps = {
  span: SpanHeader_span$key;
};
export function SpanHeader(props: SpanHeaderProps) {
  const span = useFragment(
    graphql`
      fragment SpanHeader_span on Span {
        name
        spanKind
        code: statusCode
        latencyMs
        startTime
        tokenCountPrompt
        tokenCountCompletion
        tokenCountTotal
      }
    `,
    props.span
  );

  const startTime = useMemo<Date>(() => {
    return new Date(span.startTime);
  }, [span.startTime]);

  return (
    <Flex
      direction="row"
      gap="size-100"
      width="100%"
      height="100%"
      alignItems="center"
    >
      <Flex direction="column" gap="size-50">
        <Flex direction="row" gap="size-100" alignItems="center">
          <SpanKindToken spanKind={span.spanKind} />
          <Text size="L">{span.name}</Text>
          <SpanStatusCodeIcon
            statusCode={span.code}
            css={css`
              font-size: var(--ac-global-font-size-m);
            `}
          />
        </Flex>
        <Flex direction="row" gap="size-100" alignItems="center">
          {typeof span.latencyMs === "number" ? (
            <LatencyText latencyMs={span.latencyMs} size="S" />
          ) : null}
          <Text color="text-500" size="S">
            at {fullTimeFormatter(startTime)}
          </Text>
          {span.tokenCountTotal ? (
            <TokenCount
              tokenCountTotal={span.tokenCountTotal}
              tokenCountPrompt={span.tokenCountPrompt ?? 0}
              tokenCountCompletion={span.tokenCountCompletion ?? 0}
              size="S"
            />
          ) : null}
        </Flex>
      </Flex>
    </Flex>
  );
}
