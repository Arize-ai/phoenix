import { PropsWithChildren } from "react";

import { Flex, View, ViewProps } from "@phoenix/components";

type ViewSummaryAsideProps = PropsWithChildren<{
  width?: ViewProps["width"];
}>;
/**
 * A summary that's displayed on the right side of a view that shows a summary of the view's content.
 * E.x. a statistic
 */
export function ViewSummaryAside(props: ViewSummaryAsideProps) {
  const { width = "size-1250" } = props;
  return (
    <View
      width={width}
      backgroundColor="light"
      borderStartWidth="thin"
      borderStartColor="dark"
      padding="size-200"
      flex="none"
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
