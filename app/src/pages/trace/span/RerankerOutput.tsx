import { CopyToClipboardButton, Text } from "@phoenix/components";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { DocumentItem } from "../DocumentItem";
import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { documentsListCSS } from "./constants";
import type { SpanInfoSectionProps } from "./types";
import { formatJSONForCopy } from "./utils";

/**
 * The output side of a reranker span — the documents after reranking.
 */
export function RerankerOutput({
  outputDocuments,
  sectionId,
  bordered,
}: {
  outputDocuments: AttributeDocument[];
} & SpanInfoSectionProps) {
  const numOutputDocuments = outputDocuments.length;
  const cardProps = useSpanInfoCardProps("output");
  return (
    <SpanDetailsDisclosureSection
      sectionId={sectionId}
      bordered={bordered}
      title={"Output"}
      titleExtra={
        <Text color="text-700">
          {`${numOutputDocuments} ${
            numOutputDocuments === 1 ? "document" : "documents"
          }`}
        </Text>
      }
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
    </SpanDetailsDisclosureSection>
  );
}
