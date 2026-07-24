import { Card, CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";

import { defaultCardProps } from "./constants";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * A card displaying the input value of a span.
 */
export function SpanInput({ value, mimeType }: SpanIOValue) {
  const isText = mimeType === "text";
  return (
    <MarkdownDisplayProvider>
      <Card
        title="Input"
        {...defaultCardProps}
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
