import { CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";

import {
  SpanDetailsInputSection,
  SpanDetailsInputSurface,
} from "../SpanDetailsInputSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanInfoSectionProps, SpanIOValue } from "./types";

/**
 * The top-level section displaying the input value of a span.
 */
export function SpanInput({
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
        <SpanDetailsInputSurface>
          <MimeTypeCodeBlock
            value={value}
            mimeType={mimeType}
            initializeImmediately
          />
        </SpanDetailsInputSurface>
      </SpanDetailsInputSection>
    </MarkdownDisplayProvider>
  );
}
