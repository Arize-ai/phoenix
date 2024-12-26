import React, { ReactNode } from "react";

import { Flex, Text } from "@arizeai/components";

import { Icon, Icons } from "@phoenix/components";

export function PlaygroundErrorWrap({ children }: { children: ReactNode }) {
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
      <Text color="danger">{children}</Text>
    </Flex>
  );
}
