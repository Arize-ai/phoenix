import React, { PropsWithChildren } from "react";

import { Flex, View } from "@arizeai/components";

/**
 * A summary that's displayed on the right side of a view that shows a summary of the view's content.
 * E.x. a statistic
 */
export function ViewSummaryAside(props: PropsWithChildren) {
  return (
    <View
      width="size-1250"
      backgroundColor="gray-700"
      borderStartWidth="thin"
      borderStartColor="dark"
      padding="size-100"
    >
      <Flex
        direction="column"
        alignItems="end"
        justifyContent="center"
        height="100%"
      >
        {props.children}
      </Flex>
    </View>
  );
}
