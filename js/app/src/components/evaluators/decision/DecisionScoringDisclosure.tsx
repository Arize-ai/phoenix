import type { ReactNode } from "react";

import { Flex, Text } from "@phoenix/components";
import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
} from "@phoenix/components/core/disclosure";

/**
 * A collapsible, optional scoring section of a decision evaluator form. The
 * trigger shows a one-line summary of what is set so the settings need not be
 * opened to know whether they were changed.
 */
export function DecisionScoringDisclosure({
  id,
  title,
  description,
  summary,
  defaultExpanded = false,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  /** A short summary of the current settings, e.g. "Defaults". */
  summary: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Disclosure id={id} defaultExpanded={defaultExpanded}>
      <DisclosureTrigger>
        <Flex direction="column" gap="size-25">
          <Flex direction="row" gap="size-100" alignItems="center">
            <Text weight="heavy">{title}</Text>
            <Text size="S" color="text-700" data-testid={`${id}-summary`}>
              {summary}
            </Text>
          </Flex>
          {description ? (
            <Text size="XS" color="text-700">
              {description}
            </Text>
          ) : null}
        </Flex>
      </DisclosureTrigger>
      <DisclosurePanel>{children}</DisclosurePanel>
    </Disclosure>
  );
}
