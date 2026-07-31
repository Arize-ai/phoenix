import type { PropsWithChildren } from "react";

import { ExpandableContent } from "@phoenix/components/core/content";

/**
 * Bounds potentially large content inside a span card and adds an inline
 * expand affordance only when the rendered content overflows the global XL
 * expansion cutoff.
 *
 * This state intentionally stays local to the content. The span details
 * expand-all control owns disclosure cards, not overflow affordances inside
 * those cards.
 */
export function ExpandableSpanContent({
  children,
  overlayBackgroundColor,
}: PropsWithChildren<{ overlayBackgroundColor?: string }>) {
  return (
    <ExpandableContent
      height="xl"
      expandedBehavior="grow"
      overlayBackgroundColor={overlayBackgroundColor}
    >
      {children}
    </ExpandableContent>
  );
}
