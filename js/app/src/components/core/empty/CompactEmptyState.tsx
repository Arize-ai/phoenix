import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useContext } from "react";
import {
  AutocompleteStateContext,
  ComboBoxStateContext,
} from "react-aria-components";

import { Text } from "@phoenix/components/core/content";
import { Icon, Icons } from "@phoenix/components/core/icon";

import { subtleEmptyTextCSS } from "./styles";

// Fills its area and centers the icon over the description. The passed <Icon>
// is pinned to 24px by sizing its `.icon-wrap` (which wins on specificity over
// the Icon component's own em-based `svg { width: 1em }`). Color/opacity come
// from `subtleEmptyTextCSS` — both the icon (via `currentColor`) and the
// description (`.text` inherits) take that subtle grey.
const compactEmptyStateCSS = css`
  width: 100%;
  // border-box so the 100% width includes the padding below; otherwise padding
  // is added outside the full width and overflows the popover → horizontal scroll.
  box-sizing: border-box;
  // Inherit the container's min-height so the glow fills sized regions (a sized
  // View, TableEmptyWrap, or command palette menu) while still wrapping to
  // content in compact popovers.
  min-height: inherit;
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
  /**
   * Whether the collection is empty because an active search/filter matched
   * nothing — not because it is genuinely empty. When filtered, the `icon` and
   * `description` are replaced with the search icon and "No results", so one
   * call site covers both states (e.g. "No tags" → "No results" on search).
   *
   * Defaults to auto-detection: inside a React Aria `Autocomplete` or
   * `ComboBox`, a non-empty input value means "filtered". Pass it explicitly
   * only for surfaces with no such context, e.g. a server-filtered table
   * (`isFiltered={!!filterText}`).
   */
  isFiltered?: boolean;
}

/**
 * True when rendered inside an `Autocomplete`/`ComboBox` whose input has text.
 * That's the difference between "no items exist" and "the query matched none",
 * and it holds even when the underlying list is empty — typing into an empty
 * tags menu still reads as a search.
 */
function useIsFiltered(): boolean {
  const autocomplete = useContext(AutocompleteStateContext);
  const comboBox = useContext(ComboBoxStateContext);
  const query = autocomplete?.inputValue ?? comboBox?.inputValue ?? "";
  return query.trim().length > 0;
}

/**
 * A lightweight empty state: a 24px icon above a subtle description, centered,
 * with a faint radial glow behind it. Lighter than {@link EmptyState} (no
 * stacked-card graphic, title, or action strip) and richer than the bare-text
 * {@link Empty}. Good for menus/listboxes (via `renderEmptyState`), popovers,
 * cards, and other small regions where a full empty state reads too heavy.
 * @example
 * <CompactEmptyState
 *   icon={<Icon svg={<Icons.Database />} />}
 *   description="No datasets"
 * />
 */
export function CompactEmptyState({
  icon,
  description,
  isFiltered: isFilteredProp,
}: CompactEmptyStateProps) {
  const autoFiltered = useIsFiltered();
  const isFiltered = isFilteredProp ?? autoFiltered;
  return (
    <div css={[compactEmptyStateCSS, subtleEmptyTextCSS]}>
      {isFiltered ? <Icon svg={<Icons.Search />} /> : icon}
      <Text size="S">{isFiltered ? "No results" : description}</Text>
    </div>
  );
}
