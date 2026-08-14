import { Flex } from "@phoenix/components";

import { RetrieverInput } from "./RetrieverInput";
import { RetrieverOutput } from "./RetrieverOutput";
import type { AttributeObject, SpanInfoData } from "./types";
import {
  getRetrieverAttributes,
  groupDocumentEvaluationsByPosition,
} from "./utils";

/**
 * The info view for a retriever span — the input query and the retrieved
 * documents.
 */
export function RetrieverSpanInfo({
  span,
  spanAttributes,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
}) {
  const { input } = span;
  const { documents } = getRetrieverAttributes(spanAttributes);
  const documentEvaluationsByPosition = groupDocumentEvaluationsByPosition(
    span.documentEvaluations
  );

  const hasInput = input != null && input.value != null;
  const hasDocuments = documents.length > 0;
  return (
    <Flex direction="column" gap="size-200">
      {hasInput ? <RetrieverInput {...input} /> : null}
      {hasDocuments ? (
        <RetrieverOutput
          documents={documents}
          documentEvaluationsByPosition={documentEvaluationsByPosition}
          retrievalMetrics={span.documentRetrievalMetrics}
          spanNodeId={span.id}
        />
      ) : null}
    </Flex>
  );
}
