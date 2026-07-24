import {
  Card,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  View,
} from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { DocumentItem } from "../DocumentItem";
import { defaultCardProps, documentsListCSS } from "./constants";

/**
 * The input side of a reranker span — the query and the documents that were
 * passed in to be reranked, grouped under a single "Input" card so the reranker
 * span details stay consistent with other span types.
 */
export function RerankerInput({
  query,
  inputDocuments,
}: {
  query: string | null;
  inputDocuments: AttributeDocument[];
}) {
  const numInputDocuments = inputDocuments.length;
  return (
    <Card
      title="Input"
      subTitle={`${numInputDocuments} ${numInputDocuments === 1 ? "document" : "documents"}`}
      {...defaultCardProps}
    >
      <MarkdownDisplayProvider>
        <DisclosureGroup defaultExpandedKeys={["query"]}>
          {query && (
            <Disclosure id="query">
              <DisclosureTrigger arrowPosition="start">Query</DisclosureTrigger>
              <DisclosurePanel>
                <View paddingX="size-200" paddingY="size-100">
                  <ConnectedMarkdownBlock margin="none">
                    {query}
                  </ConnectedMarkdownBlock>
                </View>
              </DisclosurePanel>
            </Disclosure>
          )}
          <Disclosure id="input-documents">
            <DisclosureTrigger arrowPosition="start">
              Documents
            </DisclosureTrigger>
            <DisclosurePanel>
              <ul css={documentsListCSS}>
                {inputDocuments.map((document, idx) => (
                  <li key={idx}>
                    <DocumentItem document={document} />
                  </li>
                ))}
              </ul>
            </DisclosurePanel>
          </Disclosure>
        </DisclosureGroup>
      </MarkdownDisplayProvider>
    </Card>
  );
}
