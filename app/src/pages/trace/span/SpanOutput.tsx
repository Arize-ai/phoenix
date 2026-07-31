import { CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";

import { SpanDetailsDisclosureSection } from "../SpanDetailsDisclosureSection";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { ExpandableSpanContent } from "./ExpandableSpanContent";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanInfoSectionProps, SpanIOValue } from "./types";

/**
 * The top-level section displaying the output value of a span.
 */
export function SpanOutput({
  value,
  mimeType,
  sectionId,
  bordered,
}: SpanIOValue & SpanInfoSectionProps) {
  const isText = mimeType === "text";
  const cardProps = useSpanInfoCardProps("output");
  return (
    <MarkdownDisplayProvider>
      <SpanDetailsDisclosureSection
        sectionId={sectionId}
        bordered={bordered}
        title="Output"
        {...cardProps}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isText ? <ConnectedMarkdownModeSelect /> : null}
            <CopyToClipboardButton text={value} />
          </Flex>
        }
      >
        <ExpandableSpanContent>
          <MimeTypeCodeBlock
            value={value}
            mimeType={mimeType}
            initializeImmediately
          />
        </ExpandableSpanContent>
      </SpanDetailsDisclosureSection>
    </MarkdownDisplayProvider>
  );
}
