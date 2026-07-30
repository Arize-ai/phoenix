import type { ReactNode } from "react";

import { Alert, Flex, View } from "@phoenix/components";

import { EmbeddingSpanInfo } from "./EmbeddingSpanInfo";
import { LLMSpanInfo } from "./LLMSpanInfo";
import { RerankerSpanInfo } from "./RerankerSpanInfo";
import { RetrieverSpanInfo } from "./RetrieverSpanInfo";
import { SpanIO } from "./SpanIO";
import { SpanMetadata } from "./SpanMetadata";
import { ToolSpanInfo } from "./ToolSpanInfo";
import type {
  AttributeObject,
  SpanInfoData,
  SpanInfoSectionIds,
  SpanInfoSectionKey,
  SpanInfoSectionProps,
} from "./types";
import {
  getEmbeddingAttributes,
  getLLMAttributes,
  getRerankerAttributes,
  getRetrieverAttributes,
  getToolAttributes,
  hasLLMInputContent,
  parseSpanAttributes,
} from "./utils";

/** Returns the ordered top-level sections that are meaningful for a span kind. */
export function getExpectedSpanInfoSectionKeys(
  spanKind: string
): SpanInfoSectionKey[] {
  switch (spanKind) {
    case "llm":
    case "tool":
      return ["input", "output", "toolDefinitions", "metadata"];
    case "embedding":
      return ["input", "metadata"];
    default:
      return ["input", "output", "metadata"];
  }
}

/** Returns the ordered top-level sections that have content for a span. */
export function getSpanInfoSectionKeys({
  span,
  spanAttributes,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject | null;
}): SpanInfoSectionKey[] {
  if (spanAttributes === null) {
    return [];
  }

  const hasInput = span.input?.value != null;
  const hasOutput = span.output?.value != null;
  let sectionKeys: SpanInfoSectionKey[];

  switch (span.spanKind) {
    case "llm": {
      const llmAttributes = getLLMAttributes(spanAttributes);
      const { outputMessages, toolSchemas } = llmAttributes;
      sectionKeys = [];
      if (hasLLMInputContent({ input: span.input, ...llmAttributes })) {
        sectionKeys.push("input");
      }
      if (hasOutput || outputMessages.length > 0) {
        sectionKeys.push("output");
      }
      if (toolSchemas.length > 0) {
        sectionKeys.push("toolDefinitions");
      }
      break;
    }
    case "retriever": {
      const { documents } = getRetrieverAttributes(spanAttributes);
      sectionKeys = [];
      if (hasInput) {
        sectionKeys.push("input");
      }
      if (documents.length > 0) {
        sectionKeys.push("output");
      }
      break;
    }
    case "reranker": {
      const { query, inputDocuments, outputDocuments } =
        getRerankerAttributes(spanAttributes);
      sectionKeys = [];
      if (query != null || inputDocuments.length > 0) {
        sectionKeys.push("input");
      }
      if (outputDocuments.length > 0) {
        sectionKeys.push("output");
      }
      break;
    }
    case "embedding": {
      const { embeddings } = getEmbeddingAttributes(spanAttributes);
      sectionKeys = embeddings.length > 0 ? ["input"] : [];
      if (embeddings.length === 0 && hasInput) {
        sectionKeys.push("input");
      }
      if (embeddings.length === 0 && hasOutput) {
        sectionKeys.push("output");
      }
      break;
    }
    case "tool": {
      const { hasToolAttributes } = getToolAttributes(spanAttributes);
      sectionKeys = [];
      if (hasInput) {
        sectionKeys.push("input");
      }
      if (hasOutput) {
        sectionKeys.push("output");
      }
      if (hasToolAttributes) {
        sectionKeys.push("toolDefinitions");
      }
      break;
    }
    default: {
      sectionKeys = [];
      if (hasInput) {
        sectionKeys.push("input");
      }
      if (hasOutput) {
        sectionKeys.push("output");
      }
    }
  }

  if (spanAttributes.metadata != null) {
    sectionKeys.push("metadata");
  }
  return sectionKeys;
}

/**
 * The main info view for a span — parses the span attributes and renders the
 * view for the span's kind.
 */
export function SpanInfo({
  span,
  sectionIds,
}: {
  span: SpanInfoData;
  sectionIds: SpanInfoSectionIds;
}) {
  const { spanKind, attributes } = span;
  // Parse the attributes once
  const { json: attributesObject, parseError } =
    parseSpanAttributes(attributes);

  // Handle the case where the attributes are not a valid JSON object
  if (parseError || !attributesObject) {
    return (
      <View padding="size-100">
        <Flex direction="column" gap="size-200">
          <Alert variant="warning" title="Un-parsable attributes">
            {`Failed to parse span attributes. ${parseError instanceof Error ? parseError.message : ""}`}
          </Alert>
        </Flex>
      </View>
    );
  }

  const sectionKeys = getSpanInfoSectionKeys({
    span,
    spanAttributes: attributesObject,
  });
  const getSectionProps = (
    sectionKey: SpanInfoSectionKey
  ): SpanInfoSectionProps => ({
    sectionId: sectionIds[sectionKey],
    bordered: sectionKeys[0] !== sectionKey,
  });

  let content: ReactNode;
  switch (spanKind) {
    case "llm": {
      content = (
        <LLMSpanInfo
          span={span}
          spanAttributes={attributesObject}
          inputSectionProps={getSectionProps("input")}
          outputSectionProps={getSectionProps("output")}
          toolDefinitionsSectionProps={getSectionProps("toolDefinitions")}
        />
      );
      break;
    }
    case "retriever": {
      content = (
        <RetrieverSpanInfo
          span={span}
          spanAttributes={attributesObject}
          inputSectionProps={getSectionProps("input")}
          outputSectionProps={getSectionProps("output")}
        />
      );
      break;
    }
    case "reranker": {
      content = (
        <RerankerSpanInfo
          spanAttributes={attributesObject}
          inputSectionProps={getSectionProps("input")}
          outputSectionProps={getSectionProps("output")}
        />
      );
      break;
    }
    case "embedding": {
      content = (
        <EmbeddingSpanInfo
          span={span}
          spanAttributes={attributesObject}
          inputSectionProps={getSectionProps("input")}
          outputSectionProps={getSectionProps("output")}
        />
      );
      break;
    }
    case "tool": {
      content = (
        <ToolSpanInfo
          span={span}
          spanAttributes={attributesObject}
          inputSectionProps={getSectionProps("input")}
          outputSectionProps={getSectionProps("output")}
          toolDefinitionsSectionProps={getSectionProps("toolDefinitions")}
        />
      );
      break;
    }
    default:
      content = (
        <SpanIO
          input={span.input}
          output={span.output}
          inputSectionProps={getSectionProps("input")}
          outputSectionProps={getSectionProps("output")}
        />
      );
  }

  return (
    <>
      {content}
      {attributesObject.metadata != null ? (
        <SpanMetadata
          metadata={attributesObject.metadata}
          {...getSectionProps("metadata")}
        />
      ) : null}
    </>
  );
}
