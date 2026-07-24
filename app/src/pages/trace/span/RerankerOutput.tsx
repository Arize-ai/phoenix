import { Card } from "@phoenix/components";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { DocumentItem } from "../DocumentItem";
import { defaultCardProps, documentsListCSS } from "./constants";

/**
 * The output side of a reranker span — the documents after reranking.
 */
export function RerankerOutput({
  outputDocuments,
}: {
  outputDocuments: AttributeDocument[];
}) {
  const numOutputDocuments = outputDocuments.length;
  return (
    <Card
      title={"Output"}
      subTitle={`${numOutputDocuments} ${numOutputDocuments === 1 ? "document" : "documents"}`}
      {...defaultCardProps}
    >
      <ul css={documentsListCSS}>
        {outputDocuments.map((document, idx) => (
          <li key={idx}>
            <DocumentItem document={document} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
