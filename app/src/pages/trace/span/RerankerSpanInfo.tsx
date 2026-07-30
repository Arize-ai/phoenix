import { RerankerInput } from "./RerankerInput";
import { RerankerOutput } from "./RerankerOutput";
import type { AttributeObject, SpanInfoSectionProps } from "./types";
import { getRerankerAttributes } from "./utils";

/**
 * The info view for a reranker span — the query and the documents before and
 * after reranking.
 */
export function RerankerSpanInfo({
  spanAttributes,
  inputSectionProps,
  outputSectionProps,
}: {
  spanAttributes: AttributeObject;
  inputSectionProps: SpanInfoSectionProps;
  outputSectionProps: SpanInfoSectionProps;
}) {
  const { query, inputDocuments, outputDocuments } =
    getRerankerAttributes(spanAttributes);

  return (
    <>
      <RerankerInput
        query={query}
        inputDocuments={inputDocuments}
        {...inputSectionProps}
      />
      <RerankerOutput
        outputDocuments={outputDocuments}
        {...outputSectionProps}
      />
    </>
  );
}
