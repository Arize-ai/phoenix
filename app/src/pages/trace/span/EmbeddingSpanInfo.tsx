import { EmbeddingInput } from "./EmbeddingInput";
import { SpanIO } from "./SpanIO";
import type {
  AttributeObject,
  SpanInfoData,
  SpanInfoSectionProps,
} from "./types";
import { getEmbeddingAttributes } from "./utils";

/**
 * The info view for an embedding span — the embedded texts, falling back to
 * the generic input / output view when there are no embeddings.
 */
export function EmbeddingSpanInfo({
  span,
  spanAttributes,
  inputSectionProps,
  outputSectionProps,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
  inputSectionProps: SpanInfoSectionProps;
  outputSectionProps: SpanInfoSectionProps;
}) {
  const { embeddings } = getEmbeddingAttributes(spanAttributes);

  const hasEmbeddings = embeddings.length > 0;
  return (
    <>
      {hasEmbeddings ? (
        <EmbeddingInput embeddings={embeddings} {...inputSectionProps} />
      ) : (
        <SpanIO
          input={span.input}
          output={span.output}
          inputSectionProps={inputSectionProps}
          outputSectionProps={outputSectionProps}
        />
      )}
    </>
  );
}
