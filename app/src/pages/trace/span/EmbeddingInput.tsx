import { EmbeddingAttributePostfixes } from "@arizeai/openinference-semantic-conventions";
import { css } from "@emotion/react";

import { Card, CopyToClipboardButton, Text } from "@phoenix/components";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import type { AttributeEmbeddingEmbedding } from "@phoenix/openInference/tracing/types";

import { SpanDetailsInputSection } from "../SpanDetailsInputSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";
import { ExpandableSpanContent } from "./ExpandableSpanContent";
import type { SpanInfoSectionProps } from "./types";
import { formatTextListForCopy } from "./utils";

/**
 * The input side of an embedding span — the texts that were embedded.
 */
export function EmbeddingInput({
  embeddings,
  sectionId,
  bordered,
}: {
  embeddings: AttributeEmbeddingEmbedding[];
} & SpanInfoSectionProps) {
  const numTexts = embeddings.length;
  const cardProps = useSpanInfoCardProps("input");
  const texts = embeddings.map(
    (embedding) => embedding[EmbeddingAttributePostfixes.text] || ""
  );
  return (
    <SpanDetailsInputSection
      sectionId={sectionId}
      bordered={bordered}
      titleExtra={
        <Text color="text-700">
          {`${numTexts} ${numTexts === 1 ? "text" : "texts"}`}
        </Text>
      }
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
                    title="Embedded Text"
                    extra={<CopyToClipboardButton text={text} />}
                  >
                    <ExpandableSpanContent>
                      <ConnectedMarkdownBlock>{text}</ConnectedMarkdownBlock>
                    </ExpandableSpanContent>
                  </Card>
                </MarkdownDisplayProvider>
              </li>
            );
          })}
        </ul>
      }
    </SpanDetailsInputSection>
  );
}
