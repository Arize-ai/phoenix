import { EmbeddingAttributePostfixes } from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";

import { Card } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeEmbeddingEmbedding } from "@phoenix/openInference/tracing/types";

import { defaultCardProps } from "./constants";

/**
 * The input side of an embedding span — the texts that were embedded.
 */
export function EmbeddingInput({
  embeddings,
}: {
  embeddings: AttributeEmbeddingEmbedding[];
}) {
  const numTexts = embeddings.length;
  return (
    <Card
      title="Input"
      subTitle={`${numTexts} ${numTexts === 1 ? "text" : "texts"}`}
      {...defaultCardProps}
    >
      {
        <ul
          css={css`
            display: flex;
            flex-direction: column;
            gap: var(--global-dimension-size-200);
            padding: var(--global-dimension-size-200);
          `}
        >
          {embeddings.map((embedding, idx) => {
            return (
              <li key={idx}>
                <MarkdownDisplayProvider>
                  <Card
                    {...defaultCardProps}
                    backgroundColor="purple-100"
                    borderColor="purple-300"
                    title="Embedded Text"
                  >
                    <ConnectedMarkdownBlock>
                      {embedding[EmbeddingAttributePostfixes.text] || ""}
                    </ConnectedMarkdownBlock>
                  </Card>
                </MarkdownDisplayProvider>
              </li>
            );
          })}
        </ul>
      }
    </Card>
  );
}
