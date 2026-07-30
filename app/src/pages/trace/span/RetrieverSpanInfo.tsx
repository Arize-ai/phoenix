import { RetrieverInput } from "./RetrieverInput";
import { RetrieverOutput } from "./RetrieverOutput";
import type {
  AttributeObject,
  SpanInfoData,
  SpanInfoSectionProps,
} from "./types";
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
  inputSectionProps,
  outputSectionProps,
}: {
  span: SpanInfoData;
  spanAttributes: AttributeObject;
  inputSectionProps: SpanInfoSectionProps;
  outputSectionProps: SpanInfoSectionProps;
}) {
  const { input } = span;
  const { documents } = getRetrieverAttributes(spanAttributes);
  const documentEvaluationsByPosition = groupDocumentEvaluationsByPosition(
    span.documentEvaluations
  );

  const hasInput = input != null && input.value != null;
  const hasDocuments = documents.length > 0;
  return (
    <>
      {hasInput ? <RetrieverInput {...input} {...inputSectionProps} /> : null}
      {hasDocuments ? (
        <RetrieverOutput
          documents={documents}
          documentEvaluationsByPosition={documentEvaluationsByPosition}
          retrievalMetrics={span.documentRetrievalMetrics}
          spanNodeId={span.id}
          {...outputSectionProps}
        />
      ) : null}
    </>
  );
}
