import { PropsWithChildren } from "react";

import { Flex, View } from "@phoenix/components";

/**
 * A component that renders a row at the top of a table cell
 */
export function CellTop({
  children,
}: PropsWithChildren<{
  children: React.ReactNode;
}>) {
  return (
    <View
      paddingX="size-100"
      paddingY="size-50"
      borderBottomWidth="thin"
      borderColor="grey-100"
    >
      <Flex direction="row" gap="size-100" alignItems="center">
        {children}
      </Flex>
    </View>
  );
}
