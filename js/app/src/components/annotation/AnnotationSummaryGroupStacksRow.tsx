import type { ReactNode } from "react";

import { Flex } from "@phoenix/components";
import { Divider } from "@phoenix/components/core/layout";

/**
 * Lays out annotation summary stacks as peer columns alongside other header
 * metrics. The group owns its optional leading divider so empty groups do not
 * leave a dangling separator behind.
 */
export function AnnotationSummaryGroupStacksRow({
  leadingDivider = false,
  children,
}: {
  leadingDivider?: boolean;
  children: ReactNode;
}) {
  return (
    <Flex direction="row" gap="size-400" alignItems="stretch" flex="none">
      {leadingDivider ? <Divider orientation="vertical" /> : null}
      {children}
    </Flex>
  );
}
