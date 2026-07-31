import { css } from "@emotion/react";

/** How long the copied affordance remains visible after a copy. */
export const SHOW_COPIED_TIMEOUT_MS = 2000;

/**
 * A ghost-style copy button that keeps the visible value stable as its
 * affordance changes. Truncation is opt-in so metadata IDs remain complete by
 * default.
 */
export const copyableIDBadgeButtonCSS = css`
  all: unset;
  display: inline-flex;
  box-sizing: border-box;
  min-width: 0;
  cursor: pointer;
  align-items: center;
  gap: var(--global-dimension-size-50);
  color: var(--global-text-color-500);
  border-radius: var(--global-rounding-small);
  padding: var(--global-dimension-size-25) var(--global-dimension-size-50);
  margin: calc(-1 * var(--global-dimension-size-25))
    calc(-1 * var(--global-dimension-size-50));

  &[data-size="S"] {
    font-size: var(--global-badge-font-size-s);
  }
  &[data-size="M"] {
    font-size: var(--global-badge-font-size-m);
  }
  &[data-size="L"] {
    font-size: var(--global-badge-font-size-l);
  }

  .copyable-id-badge__icon {
    flex: none;
  }

  .copyable-id-badge__value {
    white-space: nowrap;
  }

  &[data-overflow-mode="truncate"] {
    max-width: var(--global-dimension-size-5000);

    .copyable-id-badge__value {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .copyable-id-badge__value--measured-truncated {
      display: flex;
      flex: 1 1 auto;
      text-overflow: clip;

      .copyable-id-badge__prefix,
      .copyable-id-badge__ellipsis,
      .copyable-id-badge__suffix {
        flex: none;
      }
    }
  }

  &:focus-visible,
  &[data-focus-visible] {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--global-rounding-small);
  }
`;

/** Keeps the icon-only variant as tall as the standard metadata text. */
export const copyableIDBadgeIconOnlyCSS = css`
  min-height: var(--global-line-height-s);
  align-items: center;
`;

/** Gives full IDs room, then wraps them without preferring dash boundaries. */
export const copyableIDBadgeTooltipCSS = css`
  max-width: var(--global-dimension-size-3500);
  white-space: normal;

  .copyable-id-badge__tooltip-id {
    word-break: break-all;
  }
`;
