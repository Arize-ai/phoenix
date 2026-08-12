import { css } from "@emotion/react";
import { memo } from "react";

import { JSONBlock } from "@phoenix/components/code";
import { MarkdownBlock } from "@phoenix/components/markdown";
import { useContentType } from "@phoenix/hooks/useContentType";

const jsonBlockCSS = css`
  .cm-editor {
    background: transparent !important;
  }
`;

const textWrapCSS = css`
  font-size: var(--global-font-size-s);
  white-space: pre-wrap;
  word-break: break-word;
`;

export interface DynamicContentProps {
  /**
   * The value to render - can be any type (object, string, null, etc.)
   * Objects and arrays will be rendered as JSON
   * Strings that are valid JSON will be rendered as JSON
   * All other values will be rendered as text
   */
  value: unknown;
  /**
   * Controls how Streamdown parses markdown content.
   * - `"static"`: parses the full content at once (default, use for complete content)
   * - `"streaming"`: parses incrementally per-block with memoization (use when
   *   content is being actively streamed/appended)
   */
  mode?: "static" | "streaming";
}

/**
 * A component that dynamically renders content based on its type.
 * - JSON objects/arrays are rendered with syntax highlighting via CodeMirror
 * - Text content is rendered with markdown support
 */
export const DynamicContent = memo(function DynamicContent(
  props: DynamicContentProps
) {
  const { value, mode } = props;
  const { contentType, displayValue } = useContentType(value);

  if (value == null || displayValue === "") {
    return <span css={textWrapCSS}>--</span>;
  }

  if (contentType === "json") {
    return (
      <JSONBlock
        value={displayValue}
        css={jsonBlockCSS}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
        }}
      />
    );
  }

  // Text content with markdown support
  return (
    <MarkdownBlock mode="markdown" renderMode={mode} margin="none">
      {displayValue}
    </MarkdownBlock>
  );
});
