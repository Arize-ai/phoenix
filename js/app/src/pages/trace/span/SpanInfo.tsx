import type { ReactNode } from "react";

import { Alert, Flex, View } from "@phoenix/components";

import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { EmbeddingSpanInfo } from "./EmbeddingSpanInfo";
import { LLMSpanInfo } from "./LLMSpanInfo";
import { RerankerSpanInfo } from "./RerankerSpanInfo";
import { RetrieverSpanInfo } from "./RetrieverSpanInfo";
import { SpanAnnotationsCard } from "./SpanAnnotationsCard";
import { SpanAttributesCard } from "./SpanAttributesCard";
import { SpanIO } from "./SpanIO";
import { SpanMetadata } from "./SpanMetadata";
import { SpanNotesCard } from "./SpanNotesCard";
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
  // The other cards reach the tab's expand/collapse control from inside their
  // own components; this one also renders in the attributes tab, where it is
  // the whole view and has nothing to collapse alongside.
  const attributesCardProps = useSpanInfoCardProps("attributes");

  const statusDescription = span.statusMessage ? (
    <Alert variant="danger">{span.statusMessage}</Alert>
  ) : null;

  const annotationsCard = <SpanAnnotationsCard spanNodeId={span.id} />;
  const notesCard = <SpanNotesCard spanNodeId={span.id} />;

  // Handle the case where the attributes are not a valid JSON object
  if (parseError || !attributesObject) {
    return (
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {statusDescription}
          {annotationsCard}
          <Alert variant="warning" title="Un-parsable attributes">
            {`Failed to parse span attributes. ${parseError instanceof Error ? parseError.message : ""}`}
          </Alert>
          {/* open here, unlike below: with nothing parsed to render above it,
              the raw attributes are all there is to look at */}
          <SpanAttributesCard
            attributes={attributes}
            {...attributesCardProps}
          />
          {notesCard}
        </Flex>
      </View>
    );
  }

  let content: ReactNode;
  // Spans of a known kind always render their kind-specific cards. The generic
  // fallback renders only what was recorded, so a span with neither an input
  // nor an output leaves nothing above the attributes card.
  let hasContentAboveAttributes = true;
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
      hasContentAboveAttributes =
        span.input?.value != null || span.output?.value != null;
      content = <SpanIO input={span.input} output={span.output} />;
  }

  const hasMetadata = attributesObject.metadata != null;

  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-200">
        {statusDescription}
        {annotationsCard}
        {content}
        {hasMetadata ? (
          <SpanMetadata metadata={attributesObject.metadata} />
        ) : null}
        {/* Every span has attributes, but the cards above already surface the
            ones that matter for its kind, so this is the fallback for
            everything they leave out — collapsed while there is something
            above it to read, open when it is all the span has. */}
        <SpanAttributesCard
          attributes={attributes}
          defaultOpen={!hasContentAboveAttributes && !hasMetadata}
          {...attributesCardProps}
        />
        {notesCard}
      </Flex>
    </View>
  );
}
