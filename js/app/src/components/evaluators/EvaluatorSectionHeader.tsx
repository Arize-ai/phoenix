import type { ReactNode } from "react";

import { Flex, Heading, Text } from "@phoenix/components";

/** The heading and description an evaluator form section opens with. */
export const EvaluatorSectionHeader = ({
  title,
  description,
  extra,
}: {
  title: string;
  description: string;
  /** Controls rendered on the right side of the header, e.g. compact fields. */
  extra?: ReactNode;
}) => (
  // The row wraps so the extra controls drop onto their own line instead of
  // forcing a horizontal scrollbar when the host panel is resized narrow.
  <Flex
    direction="row"
    justifyContent="space-between"
    alignItems="center"
    gap="size-200"
    wrap
  >
    <Flex direction="column" gap="size-25">
      <Heading level={2} weight="heavy">
        {title}
      </Heading>
      <Text color="text-500" size="S">
        {description}
      </Text>
    </Flex>
    {extra}
  </Flex>
);
