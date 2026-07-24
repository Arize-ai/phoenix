import type { PropsWithChildren, ReactNode } from "react";

import { Flex, Heading, Text } from "@phoenix/components";
import type { SpanInfoData } from "@phoenix/pages/trace/span";

export function DetailPanelExamples({ children }: PropsWithChildren) {
  return (
    <Flex direction="column" gap="size-600" width="100%">
      {children}
    </Flex>
  );
}

export function DetailPanelExample({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: ReactNode }>) {
  return (
    <Flex direction="column" gap="size-150" width="100%">
      <Flex direction="column" gap="size-50">
        <Heading level={3} weight="heavy">
          {title}
        </Heading>
        {description ? <Text color="text-700">{description}</Text> : null}
      </Flex>
      {children}
    </Flex>
  );
}

const BASE_SPAN: SpanInfoData = {
  attributes: "{}",
  documentEvaluations: [],
  documentRetrievalMetrics: [],
  id: "span-node-storybook",
  input: null,
  output: null,
  spanKind: "chain",
  statusMessage: "",
};

export function createSpanInfoFixture(
  overrides: Partial<SpanInfoData> = {}
): SpanInfoData {
  return { ...BASE_SPAN, ...overrides };
}
