import { css } from "@emotion/react";

import { Card, Counter, View } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import { DocumentItem } from "../DocumentItem";
import { defaultCardProps } from "./constants";

/**
 * The input side of a reranker span — the query and the documents that were
 * passed in to be reranked.
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
    <>
      <MarkdownDisplayProvider>
        {query && (
          <Card title="Query" {...defaultCardProps}>
            <View padding="size-200">
              <ConnectedMarkdownBlock>{query}</ConnectedMarkdownBlock>
            </View>
          </Card>
        )}
      </MarkdownDisplayProvider>
      <Card
        title={"Input Documents"}
        titleExtra={<Counter>{numInputDocuments}</Counter>}
        {...defaultCardProps}
        defaultOpen={false}
      >
        {
          <ul
            css={css`
              padding: var(--global-dimension-size-200);
              display: flex;
              flex-direction: column;
              gap: var(--global-dimension-size-200);
            `}
          >
            {inputDocuments.map((document, idx) => {
              return (
                <li key={idx}>
                  <DocumentItem
                    document={document}
                    borderColor={"seafoam-300"}
                    backgroundColor={"seafoam-100"}
                    tokenColor="var(--global-color-seafoam-1000)"
                  />
                </li>
              );
            })}
          </ul>
        }
      </Card>
    </>
  );
}
