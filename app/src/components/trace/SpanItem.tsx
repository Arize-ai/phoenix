import React from "react";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@arizeai/components";

import { formatFloat } from "@phoenix/utils/numberFormatUtils";

import { SpanKindLabel } from "./SpanKindLabel";

interface SpanItemProps {
  name: string;
  spanKind: string;
  latencyMs: number;
}
export function SpanItem(props: SpanItemProps) {
  return (
    <View height="size-500" width="100%">
      <Flex
        direction="row"
        gap="size-100"
        width="100%"
        height="100%"
        alignItems="center"
      >
        <SpanKindLabel spanKind={props.spanKind} />
        <View flex="1 1 auto">
          <div
            css={css`
              float: left;
            `}
          >
            <Text>{props.name}</Text>
          </div>
        </View>
        <Text color="white70" textSize="small">
          {formatFloat(props.latencyMs / 1000)}s
        </Text>
      </Flex>
    </View>
  );
}
