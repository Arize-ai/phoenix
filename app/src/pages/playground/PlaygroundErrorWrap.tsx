import { ReactNode } from "react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

export function PlaygroundErrorWrap({
  children,
  alignItems = "center",
}: {
  children: ReactNode;
  alignItems?: "center" | "start";
}) {
  return (
    <Flex direction="row" gap="size-50" alignItems={alignItems}>
      <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
      <Text color="danger">{children}</Text>
    </Flex>
  );
}
