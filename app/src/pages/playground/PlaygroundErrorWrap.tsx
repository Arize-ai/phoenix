import { ReactNode } from "react";

import { Flex, Icon, Icons, Text } from "@phoenix/components";

export function PlaygroundErrorWrap({ children }: { children: ReactNode }) {
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
      <Text color="danger">{children}</Text>
    </Flex>
  );
}
