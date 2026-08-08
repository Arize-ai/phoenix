import { Flex } from "@phoenix/components";

import { RerankerInput } from "./RerankerInput";
import { RerankerOutput } from "./RerankerOutput";
import type { AttributeObject } from "./types";
import { getRerankerAttributes } from "./utils";

/**
 * The info view for a reranker span — the query and the documents before and
 * after reranking.
 */
export function RerankerSpanInfo({
  spanAttributes,
}: {
  spanAttributes: AttributeObject;
}) {
  const { query, inputDocuments, outputDocuments } =
    getRerankerAttributes(spanAttributes);

  return (
    <Flex direction="column" gap="size-200">
      <RerankerInput query={query} inputDocuments={inputDocuments} />
      <RerankerOutput outputDocuments={outputDocuments} />
    </Flex>
  );
}
