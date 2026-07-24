import type { ReactNode } from "react";

import { Alert, Card, Flex, View } from "@phoenix/components";

import { defaultCardProps } from "./constants";
import { EmbeddingSpanInfo } from "./EmbeddingSpanInfo";
import { LLMSpanInfo } from "./LLMSpanInfo";
import { RerankerSpanInfo } from "./RerankerSpanInfo";
import { RetrieverSpanInfo } from "./RetrieverSpanInfo";
import { SpanIO } from "./SpanIO";
import { SpanMetadata } from "./SpanMetadata";
import { ToolSpanInfo } from "./ToolSpanInfo";
import type { SpanInfoData } from "./types";
import { parseSpanAttributes } from "./utils";

/**
 * The main info view for a span — parses the span attributes and renders the
 * view for the span's kind.
 */
export function SpanInfo({ span }: { span: SpanInfoData }) {
  const { spanKind, attributes } = span;
  // Parse the attributes once
  const { json: attributesObject, parseError } =
    parseSpanAttributes(attributes);

  const statusDescription = span.statusMessage ? (
    <Alert variant="danger">{span.statusMessage}</Alert>
  ) : null;

  // Handle the case where the attributes are not a valid JSON object
  if (parseError || !attributesObject) {
    return (
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {statusDescription}
          <Alert variant="warning" title="Un-parsable attributes">
            {`Failed to parse span attributes. ${parseError instanceof Error ? parseError.message : ""}`}
          </Alert>
          <Card {...defaultCardProps} title="Attributes">
            <View padding="size-100">{attributes}</View>
          </Card>
        </Flex>
      </View>
    );
  }

  let content: ReactNode;
  switch (spanKind) {
    case "llm": {
      content = <LLMSpanInfo span={span} spanAttributes={attributesObject} />;
      break;
    }
    case "retriever": {
      content = (
        <RetrieverSpanInfo span={span} spanAttributes={attributesObject} />
      );
      break;
    }
    case "reranker": {
      content = <RerankerSpanInfo spanAttributes={attributesObject} />;
      break;
    }
    case "embedding": {
      content = (
        <EmbeddingSpanInfo span={span} spanAttributes={attributesObject} />
      );
      break;
    }
    case "tool": {
      content = <ToolSpanInfo span={span} spanAttributes={attributesObject} />;
      break;
    }
    default:
      content = (
        <SpanIO
          input={span.input}
          output={span.output}
          attributes={span.attributes}
        />
      );
  }

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        {statusDescription}
        {content}
        {attributesObject?.metadata ? (
          <SpanMetadata metadata={attributesObject.metadata} />
        ) : null}
      </Flex>
    </View>
  );
}
