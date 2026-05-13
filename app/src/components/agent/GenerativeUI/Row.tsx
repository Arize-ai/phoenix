import type { ReactNode } from "react";

import { Flex } from "@phoenix/components/core/layout";

import { gapBySize, type GeneratedUIGap } from "./layout";

export function Row({
  gap,
  children,
}: {
  gap: GeneratedUIGap | null;
  children?: ReactNode;
}) {
  return (
    <Flex direction="row" wrap gap={gapBySize[gap ?? "md"]}>
      {children}
    </Flex>
  );
}
