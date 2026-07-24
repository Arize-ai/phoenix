import { Flex } from "@phoenix/components";

import { EmbeddingInput } from "./EmbeddingInput";
import { SpanIO } from "./SpanIO";
import type { AttributeObject, SpanInfoData } from "./types";
import { getEmbeddingAttributes } from "./utils";

/**
 * The info view for an embedding span — the embedded texts, falling back to
 * the generic input / output view when there are no embeddings.
 */
export function EmbeddingSpanInfo({
  span,
  spanAttributes,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
}) {
  const { embeddings } = getEmbeddingAttributes(spanAttributes);

  const hasEmbeddings = embeddings.length > 0;
  return (
    <Flex direction="column" gap="size-200">
      {hasEmbeddings ? (
        <EmbeddingInput embeddings={embeddings} />
      ) : (
        <SpanIO
          input={span.input}
          output={span.output}
          attributes={span.attributes}
        />
      )}
    </Flex>
  );
}
