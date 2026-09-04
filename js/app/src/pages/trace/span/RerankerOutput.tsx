import { Card, CopyToClipboardButton } from "@phoenix/components";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { DocumentItem } from "../DocumentItem";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps, documentsListCSS } from "./constants";
import { formatJSONForCopy } from "./utils";

/**
 * The output side of a reranker span — the documents after reranking.
 */
export function RerankerOutput({
  outputDocuments,
}: {
  outputDocuments: AttributeDocument[];
}) {
  const numOutputDocuments = outputDocuments.length;
  const cardProps = useSpanInfoCardProps("output");
  return (
    <Card
      title={"Output"}
      subTitle={`${numOutputDocuments} ${
        numOutputDocuments === 1 ? "document" : "documents"
      }`}
      {...defaultCardProps}
      {...cardProps}
      extra={
        <CopyToClipboardButton text={formatJSONForCopy(outputDocuments)} />
      }
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
