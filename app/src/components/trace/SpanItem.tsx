import React from "react";
import { css } from "@emotion/react";

import { Flex, Icon, Icons, Text, View } from "@arizeai/components";

import { SpanStatusCode } from "@phoenix/pages/tracing/__generated__/SpansTable_spans.graphql";
import { TokenCount } from "@phoenix/pages/tracing/TokenCount";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { SpanKindLabel } from "./SpanKindLabel";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";

interface SpanItemProps {
  name: string;
  spanKind: string;
  latencyMs: number | null;
  statusCode: SpanStatusCode;
  tokenCountTotal?: number | null;
  tokenCountPrompt?: number | null;
  tokenCountCompletion?: number | null;
}
export function SpanItem(props: SpanItemProps) {
  const {
    name,
    latencyMs,
    spanKind,
    statusCode,
    tokenCountTotal,
    tokenCountPrompt,
    tokenCountCompletion,
  } = props;
  return (
    <View height="size-500" width="100%">
      <Flex
        direction="row"
        gap="size-150"
        width="100%"
        height="100%"
        alignItems="center"
      >
        <SpanKindLabel spanKind={spanKind} />
        <View flex="1 1 auto">
          <div
            css={css`
              float: left;
            `}
          >
            <Text>{name}</Text>
          </div>
        </View>
        {typeof tokenCountTotal === "number" ? (
          <TokenCount
            tokenCountTotal={tokenCountTotal}
            tokenCountPrompt={tokenCountPrompt ?? 0}
            tokenCountCompletion={tokenCountCompletion ?? 0}
          />
        ) : null}
        {latencyMs === null ? null : (
          <Flex
            direction="row"
            alignItems="center"
            justifyContent="center"
            gap="size-25"
          >
            <Icon
              svg={<Icons.ClockOutline />}
              css={css`
                color: rgba(255, 255, 255, 0.7);
                font-size: 14px;
              `}
            />
            <Text color="white70">{formatFloat(latencyMs / 1000)}s</Text>
          </Flex>
        )}
        {statusCode === "ERROR" ? (
          <SpanStatusCodeIcon statusCode="ERROR" />
        ) : null}
      </Flex>
    </View>
  );
}
