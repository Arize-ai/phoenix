import { Suspense, useState } from "react";

import {
  Button,
  Card,
  Counter,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Loading,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { RowExpandToggleButton } from "@phoenix/components/table";

import { useOpenSpanAnnotationEditor } from "../SpanAnnotationEditorContext";
import { NOTE_HOTKEY } from "../SpanNotesEditor";
import { SpanNotesTable } from "../SpanNotesTable";
import { defaultCardProps } from "./constants";
import { useSpanAnnotationCounts } from "./useSpanAnnotationCounts";

/**
 * The notes left on a span, as a card for the span info view. Notes are
 * annotations, but they read as a conversation rather than a judgement, so
 * they sit at the bottom of the view with a card of their own.
 */
export function SpanNotesCard({ spanNodeId }: { spanNodeId: string }) {
  // the count comes from the store rather than the network, so the boundary is
  // for the case where it does not; a card that renders a moment late is
  // better than one that claims the span has no notes while it waits
  return (
    <Suspense fallback={null}>
      <SpanNotesCardContents spanNodeId={spanNodeId} />
    </Suspense>
  );
}

function SpanNotesCardContents({ spanNodeId }: { spanNodeId: string }) {
  const { noteCount } = useSpanAnnotationCounts({ spanNodeId });
  const [isCollapsed, setIsCollapsed] = useState(true);
  // rows start clipped so the notes read as a grid, and open up when the
  // reader wants to read one in full
  const [areRowsExpanded, setAreRowsExpanded] = useState(false);
  // writing a note happens in the aside; this opens it on the notes section,
  // which the reader may have collapsed there
  const openSpanAnnotationEditor = useOpenSpanAnnotationEditor();
  return (
    <Card
      {...defaultCardProps}
      title="Notes"
      titleExtra={<Counter variant="quiet">{noteCount}</Counter>}
      defaultOpen={false}
      onCollapseChange={setIsCollapsed}
      extra={
        <Flex direction="row" gap="size-100" alignItems="center">
          {/* no rows to give back while the body is hidden, and none to give
              back when nobody has left a note */}
          {isCollapsed || noteCount === 0 ? null : (
            <RowExpandToggleButton
              size="S"
              isExpanded={areRowsExpanded}
              onChange={setAreRowsExpanded}
            />
          )}
          <TooltipTrigger>
            <Button
              size="S"
              aria-label="Add a note"
              leadingVisual={<Icon svg={<Icons.MessageCircle />} />}
              onPress={() => openSpanAnnotationEditor("notes")}
            />
            <Tooltip offset={1}>
              <Flex direction="row" gap="size-100" alignItems="center">
                Add a note <Keyboard>{NOTE_HOTKEY}</Keyboard>
              </Flex>
            </Tooltip>
          </TooltipTrigger>
        </Flex>
      }
    >
      {/* the table fetches on mount, and this card sits on every span info
          view -- hold the query until the reader opens it */}
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
