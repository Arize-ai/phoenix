import type { ReactNode } from "react";

import { Flex } from "@phoenix/components/core/layout";

import { gapBySize, type GeneratedUIGap } from "./layout";

export function Stack({
  gap,
  children,
}: {
  gap: GeneratedUIGap | null;
  children?: ReactNode;
}) {
  return (
    <Flex direction="column" gap={gapBySize[gap ?? "md"]}>
      {children}
    </Flex>
  );
}
