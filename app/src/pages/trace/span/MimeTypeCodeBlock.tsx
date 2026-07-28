import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import { assertUnreachable } from "@phoenix/typeUtils";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import type { SpanIOValue } from "./types";

/**
 * Renders a span input / output value according to its mime type — JSON gets a
 * readonly JSON block, text gets a markdown block.
 */
export function MimeTypeCodeBlock({
  value,
  mimeType,
  initializeImmediately = false,
}: SpanIOValue & { initializeImmediately?: boolean }) {
  switch (mimeType) {
    case "json":
      return (
        <ReadonlyJSONBlock initializeImmediately={initializeImmediately}>
          {value}
        </ReadonlyJSONBlock>
      );
    case "text":
      return <ConnectedMarkdownBlock>{value}</ConnectedMarkdownBlock>;
    default:
      return assertUnreachable(mimeType);
  }
}
