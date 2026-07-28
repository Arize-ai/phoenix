import {
  Icon,
  IconButton,
  Icons,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";

import { useSpanInfoCards } from "./SpanInfoCardsContext";

/**
 * Expands or collapses every main card in the span info tab at once, so a
 * reader can take in the shape of a span without scrolling through it. The
 * label says "sections" — that is what the cards read as to someone looking at
 * the tab, whatever they are built from.
 *
 * Individual cards stay free afterwards — expanding one back out flips this
 * control to offer the collapse again.
 */
export function SpanInfoCardsToggle() {
  const { areAllCardsCollapsed, setAllCardsOpen } = useSpanInfoCards();
  const label = areAllCardsCollapsed
    ? "Expand all sections"
    : "Collapse all sections";
  return (
    <TooltipTrigger>
      <IconButton
        size="S"
        aria-label={label}
        onPress={() => setAllCardsOpen(areAllCardsCollapsed)}
      >
        <Icon
          svg={
            areAllCardsCollapsed ? <Icons.RowExpand /> : <Icons.RowCollapse />
          }
        />
      </IconButton>
      <Tooltip offset={-5}>{label}</Tooltip>
    </TooltipTrigger>
  );
}
