import { css } from "@emotion/react";

export const markdownCSS = css`
  font-size: var(--global-font-size-s);
  line-height: var(--global-line-height-s);
  color: var(--global-text-color-900);
  overflow-wrap: anywhere;

  /* Streamdown's root div uses Tailwind "space-y-4" for vertical rhythm.
   * Since Phoenix doesn't load Tailwind, we replicate the spacing with
   * flex + gap on the root container. */
  & > div {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-static-size-200);
  }

  /* -------------------------------------------------------------------
   * Shiki syntax-highlighting token colors
   *
   * Streamdown renders each syntax token as a <span> inside the code
   * body with inline style custom properties:
   *   --sdm-c       light-theme foreground
   *   --sdm-tbg     light-theme token background (highlighted ranges)
   *   --shiki-dark  dark-theme foreground
   *
   * It expects Tailwind utility classes (text-[var(--sdm-c,inherit)],
   * dark:text-[var(--shiki-dark,…)], etc.) to read those properties.
   * Phoenix doesn't use Tailwind, so we provide the equivalent rules,
   * scoped to the code block body to avoid any bleed.
   * ------------------------------------------------------------------- */

  [data-streamdown="code-block-body"] span {
    color: var(--sdm-c, inherit);
  }

  .theme--dark & [data-streamdown="code-block-body"] span {
    color: var(--shiki-dark, var(--sdm-c, inherit));
  }

  /* -------------------------------------------------------------------
   * Code block overrides
   *
   * Streamdown's CodeBlock renders with Tailwind utility classes. We
   * selectively override layout/color properties so the code blocks
   * integrate with our design-token-based system while preserving
   * Tailwind's whitespace and line-number handling internally.
   * ------------------------------------------------------------------- */

  [data-streamdown="code-block"] {
    margin-top: var(--global-dimension-size-100);
    padding: 0;
    gap: 0;
    border: 1px solid var(--global-code-block-border-color);
    border-radius: var(--global-rounding-medium);
    background: var(--global-code-block-background-color);
    position: relative;
    overflow: hidden;
  }

  [data-streamdown="code-block-header"] {
    min-height: var(--global-dimension-size-500);
    padding: 0 var(--global-dimension-size-150);
    border-bottom: 1px solid var(--global-code-block-border-color);
    background: var(--global-code-block-header-background-color);
    color: var(--global-code-block-header-text-color);
    font-family: var(--ac-global-font-family-code);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    letter-spacing: 0.03em;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  /* Actions wrapper — reposition into the header row.
   * Streamdown renders: <div class="pointer-events-none sticky …">
   *   <div data-streamdown="code-block-actions">…</div>
   * </div>
   * We collapse the sticky wrapper's negative margin overlap and
   * absolutely position it inside the header band instead. */
  [data-streamdown="code-block"]
    > div:has([data-streamdown="code-block-actions"]) {
    position: absolute;
    top: var(--global-dimension-size-50);
    right: var(--global-dimension-size-100);
    height: var(--global-code-block-actions-wrapper-height);
    display: flex;
    align-items: center;
    margin: 0;
    z-index: 1;
    pointer-events: auto;
  }

  [data-streamdown="code-block-actions"] {
    display: flex;
    align-items: center;
    gap: var(--global-dimension-size-25);
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  [data-streamdown="code-block-actions"] button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--global-code-block-actions-button-size);
    height: var(--global-code-block-actions-button-size);
    padding: 0;
    border: 0;
    border-radius: var(--global-rounding-small);
    background: transparent;
    color: var(--global-text-color-500);
    cursor: pointer;
    transition:
      background-color 0.15s ease,
      color 0.15s ease;

    &:hover {
      background: var(--hover-background);
      color: var(--global-text-color-900);
    }

    /* Size icons to match IconButton size="S" and apply fill so
       Phoenix Icons (which rely on the Icon wrapper) inherit color. */
    & svg {
      width: var(--global-code-block-actions-icon-size);
      height: var(--global-code-block-actions-icon-size);
      fill: currentColor;
    }
  }

  [data-streamdown="code-block-body"] {
    overflow-x: auto;
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
  }

  [data-streamdown="code-block-body"] pre {
    margin: 0;
    padding: var(--global-dimension-size-150);
    background: transparent;
    font-family: var(--ac-global-font-family-code);
    font-size: var(--global-font-size-sm);
    line-height: var(--global-line-height-s);
    white-space: pre;
    overflow-x: auto;
  }

  [data-streamdown="code-block-body"] code {
    font-family: var(--ac-global-font-family-code);
    white-space: pre;
  }

  /* Each highlighted line is a <span class="block …">. Tailwind's "block"
   * utility (display:block) has no CSS backing in Phoenix, so lines collapse
   * onto a single row. We restore the block display for direct-child spans
   * of <code> to get one line per span. */
  [data-streamdown="code-block-body"] code > span {
    display: block;
  }
`;
