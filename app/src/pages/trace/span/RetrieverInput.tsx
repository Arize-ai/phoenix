import { Card, CopyToClipboardButton, Flex } from "@phoenix/components";
import {
  ConnectedMarkdownModeSelect,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";

import { defaultCardProps } from "./constants";
import { MimeTypeCodeBlock } from "./MimeTypeCodeBlock";
import type { SpanIOValue } from "./types";

/**
 * A card displaying the input (query) of a retriever span.
 */
export function RetrieverInput({ value, mimeType }: SpanIOValue) {
  const isText = mimeType === "text";
  return (
    <MarkdownDisplayProvider>
      <Card
        title="Input"
        {...defaultCardProps}
        extra={
          <Flex direction="row" gap="size-100" alignItems="center">
            {isText ? (
              <ConnectedMarkdownModeSelect />
            ) : (
              <CopyToClipboardButton text={value} />
            )}
          </Flex>
        }
      >
        <MimeTypeCodeBlock value={value} mimeType={mimeType} />
      </Card>
    </MarkdownDisplayProvider>
  );
}
