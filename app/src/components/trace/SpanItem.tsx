import React from "react";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@arizeai/components";

import { SpanStatusCode } from "@phoenix/pages/tracing/__generated__/SpansTable_spans.graphql";
import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { SpanKindLabel } from "./SpanKindLabel";
import { SpanStatusCodeIcon } from "./SpanStatusCodeIcon";

interface SpanItemProps {
  name: string;
  spanKind: string;
  latencyMs: number;
  statusCode: SpanStatusCode;
}
export function SpanItem(props: SpanItemProps) {
  const { name, latencyMs, spanKind, statusCode } = props;
  return (
    <View height="size-500" width="100%">
      <Flex
        direction="row"
        gap="size-100"
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
        <Text color="white70" textSize="small">
          {formatFloat(latencyMs / 1000)}s
        </Text>
        {statusCode === "ERROR" ? (
          <SpanStatusCodeIcon statusCode="ERROR" />
        ) : null}
      </Flex>
    </View>
  );
}
