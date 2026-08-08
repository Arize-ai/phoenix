import { Suspense, useState } from "react";

import {
  Card,
  Counter,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Loading,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { RowExpandToggleButton } from "@phoenix/components/table";
import { NOTE_HOTKEY } from "@phoenix/constants/annotationConstants";
import { usePreferencesContext } from "@phoenix/contexts";

import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import { useOpenSpanNoteBar } from "../SpanNoteBarContext";
import { SpanNotesTable } from "../SpanNotesTable";
import { defaultCardProps } from "./constants";
import { useSpanAnnotationCounts } from "./useSpanAnnotationCounts";

/**
 * The notes left on a span, as a card for the span info view. The table inside
 * fetches its own data, so this only needs the span's node id.
 */
export function SpanNotesCard({ spanNodeId }: { spanNodeId: string }) {
  // better a card that renders late than one that reads "no notes" while the
  // count is still in flight
  return (
    <Suspense fallback={null}>
      <SpanNotesCardContents spanNodeId={spanNodeId} />
    </Suspense>
  );
}

function SpanNotesCardContents({ spanNodeId }: { spanNodeId: string }) {
  const { noteCount } = useSpanAnnotationCounts({ spanNodeId });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [areRowsExpanded, setAreRowsExpanded] = useState(false);
  const openSpanNoteBar = useOpenSpanNoteBar();
  const isTakingSpanNotes = usePreferencesContext(
    (state) => state.isTakingSpanNotes
  );
  const setIsTakingSpanNotes = usePreferencesContext(
    (state) => state.setIsTakingSpanNotes
  );
  const cardProps = useSpanInfoCardProps("notes");
  return (
    <Card
      {...defaultCardProps}
      {...cardProps}
      title="Notes"
      titleExtra={<Counter variant="quiet">{noteCount}</Counter>}
      defaultOpen={false}
      onCollapseChange={setIsCollapsed}
      extra={
        <Flex direction="row" gap="size-100" alignItems="center">
          {isCollapsed || noteCount === 0 ? null : (
            <RowExpandToggleButton
              size="S"
              isExpanded={areRowsExpanded}
              onChange={setAreRowsExpanded}
            />
          )}
          <TooltipTrigger>
            <ToggleButton
              size="S"
              aria-label="Take notes"
              isSelected={isTakingSpanNotes}
              onChange={(isSelected) => {
                if (isSelected) {
                  openSpanNoteBar();
                } else {
                  setIsTakingSpanNotes(false);
                }
              }}
              leadingVisual={<Icon svg={<Icons.MessageCirclePlus />} />}
            />
            <Tooltip offset={1}>
              <Flex direction="row" gap="size-100" alignItems="center">
                {isTakingSpanNotes ? (
                  "Stop taking notes"
                ) : (
                  <>
                    Take notes <Keyboard>{NOTE_HOTKEY}</Keyboard>
                  </>
                )}
              </Flex>
            </Tooltip>
          </TooltipTrigger>
        </Flex>
      }
    >
      {/* the table fetches on mount, so hold the query until the card is open */}
      {isCollapsed ? null : (
        <Suspense fallback={<Loading />}>
          <SpanNotesTable
            spanNodeId={spanNodeId}
            areRowsExpanded={areRowsExpanded}
            emptyState={
              <CompactEmptyState
                icon={<Icon svg={<Icons.MessageCircle />} />}
                description="No notes on this span"
              />
            }
          />
        </Suspense>
      )}
    </Card>
  );
}
