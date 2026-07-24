import type { PropsWithChildren, ReactNode } from "react";

import { Flex, Heading, Text } from "@phoenix/components";
import type { SpanInfoSpan } from "@phoenix/pages/trace/SpanDetails";

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

const BASE_SPAN: SpanInfoSpan = {
  __typename: "Span",
  attributes: "{}",
  documentEvaluations: [],
  documentRetrievalMetrics: [],
  endTime: "2026-07-23T16:00:01.250Z",
  events: [],
  id: "span-node-storybook",
  input: null,
  latencyMs: 1250,
  name: "storybook-span",
  output: null,
  parentId: null,
  spanAnnotations: [],
  spanId: "7f51c3bce0c64a11",
  spanKind: "chain",
  startTime: "2026-07-23T16:00:00.000Z",
  statusCode: "OK",
  statusMessage: "",
  tokenCountTotal: null,
  trace: {
    id: "trace-node-storybook",
    traceId: "34d790eb0d3341a68b61545d765a5ff0",
  },
};

export function createSpanInfoFixture(
  overrides: Partial<SpanInfoSpan> = {}
): SpanInfoSpan {
  return { ...BASE_SPAN, ...overrides };
}
