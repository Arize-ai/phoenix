import { css, keyframes } from "@emotion/react";
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
   *  - `"text"` — compact inline display with a leading link icon (table cells)
   *  - `"title"` — no icon at rest; a copy icon appears on hover at the end
   *     of the string, with the whole string as a tap target
   * @default "text"
   */
  variant?: "text" | "title";
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const baseCSS = css`
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  border: none;
  background: none;
  padding: 0;
  color: inherit;
  line-height: inherit;

  &:focus-visible {
    outline: 1px solid var(--global-input-field-border-color-active);
    outline-offset: 2px;
    border-radius: var(--global-rounding-small);
  }
`;

// ---------------------------------------------------------------------------
// "text" variant styles (table cells — leading link icon, "copied" overlay)
// ---------------------------------------------------------------------------

const textBaseCSS = css`
  gap: var(--global-dimension-static-size-50);
  font-size: var(--global-font-size-s);

  &:hover .copy-id__text {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
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

const copiedOverlayCSS = css`
  grid-area: 1 / 1;
  justify-self: start;
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

const textIconCSS = css`
  flex-shrink: 0;
  transition: color 0.15s ease-in-out;
`;

// ---------------------------------------------------------------------------
// "title" variant styles (headings — trailing icon on hover, fade-out check)
// ---------------------------------------------------------------------------

const fadeOut = keyframes`
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
`;

const titleBaseCSS = css`
  gap: var(--global-dimension-static-size-50);
  font-size: inherit;

  &:hover .copy-id__text {
    text-decoration: underline dotted;
    text-underline-offset: 2px;
  }
`;

const titleIconBtnCSS = css`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--global-button-height-s);
  height: var(--global-button-height-s);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  opacity: 0;
  transition:
    opacity 0.15s ease-in-out,
    background-color 0.15s ease-in-out;

  button:hover > &,
  button:focus-visible > & {
    opacity: 1;
  }

  button:hover > &:hover {
    background-color: var(--hover-background);
  }
`;

const titleIconBtnCopiedCSS = css`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--global-button-height-s);
  height: var(--global-button-height-s);
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  opacity: 1;
  animation: ${fadeOut} ${SHOW_COPIED_TIMEOUT_MS}ms ease-in-out forwards;
`;

const monoCSS = css`
  font-family: "Geist Mono", monospace;
  white-space: nowrap;
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays an ID in monospace font with click-to-copy.
 *
 * **"text"** variant (default): a leading link icon is always visible; on
 * click the text is briefly overlaid with "copied".
 *
 * **"title"** variant: no icon at rest. On hover a copy icon appears at the
 * end of the string. On click a checkmark appears and fades away.
 */
export function CopyId({ id, truncate, variant = "text" }: CopyIdProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      copy(id);
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, SHOW_COPIED_TIMEOUT_MS);
    },
    [id]
  );

  const safeLimit =
    truncate != null ? Math.max(truncate, MIN_TRUNCATE_LENGTH) : undefined;
  const displayText = useMemo(() => {
    if (safeLimit == null || id.length <= safeLimit) {
      return id;
    }
    return id.slice(0, safeLimit) + "…";
  }, [id, safeLimit]);

  if (variant === "title") {
    return (
      <button
        type="button"
        className="copy-id"
        css={css(baseCSS, titleBaseCSS)}
        onClick={handleCopy}
        title={id}
        aria-label={`Copy ${id}`}
      >
        <span className="copy-id__text" css={monoCSS}>
          {displayText}
        </span>
        <span css={isCopied ? titleIconBtnCopiedCSS : titleIconBtnCSS}>
          <Icon svg={isCopied ? <Icons.Checkmark /> : <Icons.Copy />} />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="copy-id"
      css={css(baseCSS, textBaseCSS)}
      onClick={handleCopy}
      title={id}
      aria-label={`Copy ${id}`}
    >
      <Icon
        svg={isCopied ? <Icons.Checkmark /> : <Icons.LinkOutline />}
        css={textIconCSS}
      />
      <span className="copy-id__text-container" css={textContainerCSS}>
        <span
          className="copy-id__text"
          css={css(cellCSS, isCopied && hiddenCSS)}
        >
          {displayText}
        </span>
        {isCopied && (
          <span className="copy-id__copied" css={copiedOverlayCSS}>
            Copied
          </span>
        )}
      </span>
    </button>
  );
}
