import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Text } from "@phoenix/components/core/content";

import { subtleEmptyTextCSS } from "./styles";

// Fills its area and centers the icon over the description. The passed <Icon>
// is pinned to 24px by sizing its `.icon-wrap` (which wins on specificity over
// the Icon component's own em-based `svg { width: 1em }`). Color/opacity come
// from `subtleEmptyTextCSS` — both the icon (via `currentColor`) and the
// description (`.text` inherits) take that subtle grey.
const compactEmptyStateCSS = css`
  width: 100%;
  // Tall enough for the glow below to fade out within the box rather than being
  // clipped at the top/bottom edges by the short content height.
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--global-dimension-size-50);
  padding: var(--global-dimension-size-200);
  text-align: center;
  // Faint glow behind the center, to lift the icon off the background: a soft
  // dark halo in light mode, flipped to white in dark mode below.
  background: radial-gradient(
    circle 80px at center,
    rgba(0, 0, 0, 0.05),
    transparent
  );
  .theme--dark & {
    background: radial-gradient(
      circle 80px at center,
      rgba(255, 255, 255, 0.03),
      transparent
    );
  }
  .icon-wrap {
    width: 24px;
    height: 24px;
    font-size: 24px;
  }
  // Keep the caption narrow and balance it across lines so a wrap reads as two
  // even lines rather than a long line plus an orphan.
  .text {
    max-width: 180px;
    text-wrap: balance;
  }
`;

interface CompactEmptyStateProps {
  /** A Phoenix `<Icon>` rendered at 24px, centered above the description. */
  icon: ReactNode;
  /** Subtle short description shown beneath the icon; wraps to ~180px wide. */
  description: ReactNode;
}

/**
 * A lightweight empty state: a 24px icon above a subtle description, centered,
 * with a faint radial glow behind it. Lighter than {@link EmptyState} (no
 * stacked-card graphic, title, or action strip) and richer than the bare-text
 * {@link Empty}. Good for menus/listboxes (via `renderEmptyState`), popovers,
 * cards, and other small regions where a full empty state reads too heavy.
 * @example
 * <CompactEmptyState
 *   icon={<Icon svg={<Icons.DatabaseOutline />} />}
 *   description="No datasets found"
 * />
 */
export function CompactEmptyState({
  icon,
  description,
}: CompactEmptyStateProps) {
  return (
    <div css={[compactEmptyStateCSS, subtleEmptyTextCSS]}>
      {icon}
      <Text size="S">{description}</Text>
    </div>
  );
}
