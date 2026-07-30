import type { PropsWithChildren } from "react";

import { ExpandableContent } from "@phoenix/components/core/content";

const COLLAPSED_SPAN_CONTENT_HEIGHT_PIXELS = 320;

/**
 * Bounds potentially large content inside a span card and adds an inline
 * expand affordance only when the rendered content overflows that boundary.
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
      height={COLLAPSED_SPAN_CONTENT_HEIGHT_PIXELS}
      expandedBehavior="grow"
      overlayBackgroundColor={overlayBackgroundColor}
    >
      {children}
    </ExpandableContent>
  );
}
