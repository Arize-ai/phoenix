import { CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";

import { SpanDetailsInputSection } from "../SpanDetailsInputSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanInfoSectionProps, SpanIOValue } from "./types";

/**
 * A card displaying the input (query) of a retriever span.
 */
export function RetrieverInput({
  value,
  mimeType,
  sectionId,
  bordered,
}: SpanIOValue & SpanInfoSectionProps) {
  const isText = mimeType === "text";
  const cardProps = useSpanInfoCardProps("input");
  return (
    <MarkdownDisplayProvider>
      <SpanDetailsInputSection
        sectionId={sectionId}
        bordered={bordered}
        {...cardProps}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isText ? <ConnectedMarkdownModeSelect /> : null}
            <CopyToClipboardButton text={value} />
          </Flex>
        }
      >
        <MimeTypeCodeBlock
          value={value}
          mimeType={mimeType}
          initializeImmediately
        />
      </SpanDetailsInputSection>
    </MarkdownDisplayProvider>
  );
}
