import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import { useCallback, useMemo, useState } from "react";

import { Icon, Icons } from "../icon";

const SHOW_COPIED_TIMEOUT_MS = 2000;
const MIN_TRUNCATE_LENGTH = 6;

export interface CopyIdProps {
  /**
   * The full ID value to display and copy.
   */
  id: string;
  /**
   * Maximum number of characters to display before truncating with an
   * ellipsis. Must be at least 6 to leave room for the "copied" indicator.
   * @default undefined (no truncation)
   */
  truncate?: number;
  /**
   * Visual variant.
   *  - `"text"` — compact, for use in table cells
   *  - `"title"` — larger, for use in dialog or section headings
   * @default "text"
   */
  variant?: "text" | "title";
}

const baseCSS = css`
  display: inline-flex;
  align-items: center;
  gap: var(--global-dimension-static-size-50);
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  line-height: inherit;

  &:hover .copy-id__text {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }

  &:focus-visible {
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 2px;
    border-radius: var(--global-rounding-small);
  }
`;

const textVariantCSS = css`
  font-size: var(--global-font-size-s);
`;

const titleVariantCSS = css`
  font-size: var(--global-font-size-l);
`;

const textContainerCSS = css`
  position: relative;
  display: inline-grid;
`;

const cellCSS = css`
  grid-area: 1 / 1;
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

const hiddenCSS = css`
  visibility: hidden;
`;

const copiedCSS = css`
  grid-area: 1 / 1;
  justify-self: start;
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

const iconCSS = css`
  flex-shrink: 0;
  transition: color 0.15s ease-in-out;
`;

/**
 * Displays an ID in monospace font with click-to-copy. On click the text is
 * briefly overlaid with "copied" (as a second text instance so layout does not
 * shift) and the icon switches from a clipboard to a checkmark.
 *
 * Supports an optional `truncate` prop (min 6 chars) and two visual variants:
 *  - `"text"` for table cells (default)
 *  - `"title"` for dialog/section headings
 */
export function CopyId({ id, truncate, variant = "text" }: CopyIdProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copy(id);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, SHOW_COPIED_TIMEOUT_MS);
  }, [id]);

  const safeLimit =
    truncate != null ? Math.max(truncate, MIN_TRUNCATE_LENGTH) : undefined;
  const displayText = useMemo(() => {
    if (safeLimit == null || id.length <= safeLimit) {
      return id;
    }
    return id.slice(0, safeLimit) + "…";
  }, [id, safeLimit]);

  const variantCSS = variant === "title" ? titleVariantCSS : textVariantCSS;

  return (
    <button
      type="button"
      className="copy-id"
      css={css(baseCSS, variantCSS)}
      onClick={handleCopy}
      title={id}
      aria-label={`Copy ${id}`}
    >
      <Icon
        svg={isCopied ? <Icons.Checkmark /> : <Icons.ClipboardCopy />}
        css={iconCSS}
      />
      <span className="copy-id__text-container" css={textContainerCSS}>
        <span
          className="copy-id__text"
          css={css(cellCSS, isCopied && hiddenCSS)}
        >
          {displayText}
        </span>
        {isCopied && (
          <span className="copy-id__copied" css={copiedCSS}>
            copied
          </span>
        )}
      </span>
    </button>
  );
}
