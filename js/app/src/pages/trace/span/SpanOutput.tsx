import { Card, CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";

import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { defaultCardProps } from "./constants";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * A card displaying the output value of a span.
 */
export function SpanOutput({ value, mimeType }: SpanIOValue) {
  const isText = mimeType === "text";
  const cardProps = useSpanInfoCardProps("output");
  return (
    <MarkdownDisplayProvider>
      <Card
        title="Output"
        {...defaultCardProps}
        {...cardProps}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isText ? <ConnectedMarkdownModeSelect /> : null}
            <CopyToClipboardButton text={value} />
          </Flex>
        }
      >
        <MimeTypeCodeBlock value={value} mimeType={mimeType} />
      </Card>
    </MarkdownDisplayProvider>
  );
}
