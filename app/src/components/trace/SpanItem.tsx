import React from "react";

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
    <Flex direction="column" gap="size-50" alignItems="start">
      <View>
        <Flex direction="row" gap="size-100">
          <SpanKindLabel spanKind={props.spanKind} />
          <Text>{props.name}</Text>
        </Flex>
      </View>
      <View>
        <Text color="white70" textSize="small">
          {formatFloat(props.latencyMs / 1000)}s
        </Text>
      </View>
    </Flex>
  );
}
