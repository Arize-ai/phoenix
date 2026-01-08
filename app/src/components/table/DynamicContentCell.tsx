import { memo, useMemo } from "react";
import { css } from "@emotion/react";

import { JSONBlock } from "@phoenix/components/code";
import {
  ConnectedMarkdownBlock,
  MarkdownDisplayProvider,
} from "@phoenix/components/markdown";
import { useContentType } from "@phoenix/hooks/useContentType";

import { LargeTextWrap } from "./LargeTextWrap";

const jsonBlockCSS = css`
  .cm-editor {
    background: transparent;
  }
  .cm-gutters {
    background: transparent;
  }
`;

const textWrapCSS = css`
  font-size: var(--ac-global-font-size-s);
  white-space: pre-wrap;
  word-break: break-word;
`;

export interface DynamicContentCellProps {
  /**
   * The value to render - can be any type (object, string, null, etc.)
   * Objects and arrays will be rendered as JSON
   * Strings that are valid JSON will be rendered as JSON
   * All other values will be rendered as text
   */
  value: unknown;
  /**
   * Maximum height of the content area in pixels
   * @default 300
   */
  maxHeight?: number;
}

/**
 * A table cell component that dynamically renders content based on its type.
 * - JSON objects/arrays are rendered with syntax highlighting via CodeMirror
 * - Text content is rendered with markdown support and a mode toggle
 *
 * This component is designed to be performant with streaming content and
 * works well within virtualized tables.
 */
export const DynamicContentCell = memo(function DynamicContentCell({
  value,
  maxHeight = 300,
}: DynamicContentCellProps) {
  const { contentType, displayValue } = useContentType(value);

  const content = useMemo(() => {
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
      <MarkdownDisplayProvider>
        <div css={textWrapCSS}>
          <ConnectedMarkdownBlock margin="none">
            {displayValue}
          </ConnectedMarkdownBlock>
        </div>
      </MarkdownDisplayProvider>
    );
  }, [contentType, displayValue, value]);

  return <LargeTextWrap height={maxHeight}>{content}</LargeTextWrap>;
});

export interface DynamicContentPreviewProps {
  /**
   * The value to render as a preview
   */
  value: unknown;
  /**
   * Maximum number of characters to show before truncating
   * @default 100
   */
  maxLength?: number;
}

/**
 * A compact preview variant of DynamicContentCell for table cell previews.
 * Shows truncated content with full value available in title attribute.
 */
export const DynamicContentPreview = memo(function DynamicContentPreview({
  value,
  maxLength = 100,
}: DynamicContentPreviewProps) {
  const { displayValue } = useContentType(value);

  const truncatedValue = useMemo(() => {
    if (displayValue.length <= maxLength) {
      return displayValue;
    }
    return `${displayValue.slice(0, maxLength)}...`;
  }, [displayValue, maxLength]);

  if (value == null || displayValue === "") {
    return <span>--</span>;
  }

  return (
    <span title={displayValue} className="font-mono">
      {truncatedValue}
    </span>
  );
});
