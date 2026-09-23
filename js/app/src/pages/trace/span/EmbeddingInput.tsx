import { EmbeddingAttributePostfixes } from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";

import { Card, CopyToClipboardButton } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeEmbeddingEmbedding } from "@phoenix/openInference/tracing/types";

import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";
import { formatTextListForCopy } from "./utils";

/**
 * The input side of an embedding span — the texts that were embedded.
 */
export function EmbeddingInput({
  embeddings,
}: {
  embeddings: AttributeEmbeddingEmbedding[];
}) {
  const numTexts = embeddings.length;
  const cardProps = useSpanInfoCardProps("input");
  const texts = embeddings.map(
    (embedding) => embedding[EmbeddingAttributePostfixes.text] || ""
  );
  return (
    <Card
      title="Input"
      subTitle={`${numTexts} ${numTexts === 1 ? "text" : "texts"}`}
      {...defaultCardProps}
      {...cardProps}
      extra={<CopyToClipboardButton text={formatTextListForCopy(texts)} />}
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
          {texts.map((text, idx) => {
            return (
              <li key={idx}>
                <MarkdownDisplayProvider>
                  <Card
                    {...defaultCardProps}
                    backgroundColor="purple-100"
                    borderColor="purple-300"
                    title="Embedded Text"
                    extra={<CopyToClipboardButton text={text} />}
                  >
                    <ConnectedMarkdownBlock>{text}</ConnectedMarkdownBlock>
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
