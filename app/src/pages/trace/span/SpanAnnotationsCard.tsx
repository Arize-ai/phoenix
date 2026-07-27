import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Card,
  Counter,
  Flex,
  Icon,
  Icons,
  Keyboard,
  Loading,
  OverflowRow,
  SegmentedControl,
  SegmentedControlItem,
  ToggleButton,
  Tooltip,
  TooltipTrigger,
} from "@phoenix/components";
import { AnnotationSummaryGroupTokens } from "@phoenix/components/annotation/AnnotationSummaryGroup";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { RowExpandToggleButton } from "@phoenix/components/table";
import { EDIT_ANNOTATION_HOTKEY } from "@phoenix/constants/annotationConstants";
import { usePreferencesContext } from "@phoenix/contexts";

import { useOpenSpanAnnotationEditor } from "../SpanAnnotationEditorContext";
import { SpanAnnotationsTable } from "../SpanAnnotationsTable";
import type { SpanAnnotationsCardSummaryQuery } from "./__generated__/SpanAnnotationsCardSummaryQuery.graphql";
import { defaultCardProps } from "./constants";
import { useSpanAnnotationCounts } from "./useSpanAnnotationCounts";

/** Which of the card's two readings of the annotations the body shows. */
type SpanAnnotationsView = "list" | "table";

const annotationTokenListCSS = css`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-200);
`;

/**
 * The span's annotations as a bare run of summary tokens — one per annotation
 * name, each opening the annotations behind it in a popover. The caller owns
 * the layout: a single clipped line in the card header, or a wrapping list in
 * the body.
 */
function SpanAnnotationSummaryTokens({
  spanNodeId,
  renderEmptyState,
}: {
  spanNodeId: string;
  /**
   * Rendered in place of the tokens when the span has nothing to summarize.
   * Omit in the header, where an empty run of tokens is the right amount of
   * noise for a card that already shows its count.
   */
  renderEmptyState?: () => ReactNode;
}) {
  const data = useLazyLoadQuery<SpanAnnotationsCardSummaryQuery>(
    graphql`
      query SpanAnnotationsCardSummaryQuery($id: ID!) {
        span: node(id: $id) {
          ...AnnotationSummaryGroup
        }
      }
    `,
    { id: spanNodeId },
    // the span details query already pulls these summaries in for the trace
    // header, so this usually resolves from the store without a request
    { fetchPolicy: "store-or-network" }
  );
  if (data.span == null) {
    return null;
  }
  return (
    <AnnotationSummaryGroupTokens
      span={data.span}
      renderEmptyState={renderEmptyState}
    />
  );
}

/**
 * The annotations attached to a span, as a card for the span info view. The
 * table inside fetches its own data, so this only needs the span's node id.
 *
 * Closed to start: the span's own input and output are what the reader came
 * for, and how it was judged is a question they ask afterwards — the header
 * carries the summary tokens so that question is often answered without
 * opening the card at all.
 */
export function SpanAnnotationsCard({ spanNodeId }: { spanNodeId: string }) {
  // the count comes from the store rather than the network, so the boundary is
  // for the case where it does not; a card that renders a moment late is
  // better than one that claims the span has no annotations while it waits
  return (
    <Suspense fallback={null}>
      <SpanAnnotationsCardContents spanNodeId={spanNodeId} />
    </Suspense>
  );
}

function SpanAnnotationsCardContents({ spanNodeId }: { spanNodeId: string }) {
  const { annotationCount } = useSpanAnnotationCounts({ spanNodeId });
  // the aside's editor is driven by this preference, and the toggle reads its
  // selected state from it; opening it is more than the preference, so that
  // goes through the span details view
  const isAnnotatingSpans = usePreferencesContext(
    (state) => state.isAnnotatingSpans
  );
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const openSpanAnnotationEditor = useOpenSpanAnnotationEditor();
  const [isCollapsed, setIsCollapsed] = useState(true);
  // rows start clipped so the annotations read as a grid; explanations are the
  // long value here, and the reader opens up the rows when they want one
  const [areRowsExpanded, setAreRowsExpanded] = useState(false);
  // the list is the same reading the header gives while the card is closed,
  // only wrapped rather than clipped, so opening the card continues that
  // thought rather than replacing it; the table is there for the reader who
  // wants the scores, explanations and annotators behind those tokens
  const [view, setView] = useState<SpanAnnotationsView>("list");
  const hasAnnotations = annotationCount > 0;
  // the compact state rather than the full one with its graphic: this is a card
  // in a stack of cards, not a region of its own. Shared by both views -- the
  // count includes notes, which neither view shows, so an "annotated" span can
  // still come up empty here
  const emptyState = (
    <CompactEmptyState
      icon={<Icon svg={<Icons.Edit2 />} />}
      description="No annotations on this span"
    />
  );
  return (
    <Card
      {...defaultCardProps}
      title="Annotations"
      titleExtra={<Counter variant="quiet">{annotationCount}</Counter>}
      // the summary tokens are clickable, so the collapse toggle is a
      // standalone arrow rather than a button wrapping the whole header
      interactiveTitle
      collapseButtonLabel="Annotations"
      headerContent={
        // once the card is open the body carries the summary in full, and a
        // clipped copy of it in the header would only repeat what is already
        // on screen
        !hasAnnotations || !isCollapsed ? null : (
          // no fallback: the summaries are usually already in the store, and a
          // spinner in the header would flash for the case where they are not
          <Suspense fallback={null}>
            <OverflowRow>
              <SpanAnnotationSummaryTokens spanNodeId={spanNodeId} />
            </OverflowRow>
          </Suspense>
        )
      }
      defaultOpen={false}
      onCollapseChange={setIsCollapsed}
      extra={
        <Flex direction="row" gap="size-100" alignItems="center">
          {/* nothing to switch between or expand while the body is hidden, and
              nothing to show either way when the span has never been annotated */}
          {isCollapsed || !hasAnnotations ? null : (
            <>
              {/* only the table has rows to give back, and it sits before the
                  control that summoned it -- the view switch stays put next to
                  the annotate toggle rather than sliding over when the row
                  toggle appears */}
              {view === "table" ? (
                <RowExpandToggleButton
                  size="S"
                  isExpanded={areRowsExpanded}
                  onChange={setAreRowsExpanded}
                />
              ) : null}
              <SegmentedControl
                aria-label="Annotations view"
                size="S"
                selectedKey={view}
                onSelectionChange={(key) =>
                  setView(key === "table" ? "table" : "list")
                }
              >
                <SegmentedControlItem id="list">List</SegmentedControlItem>
                <SegmentedControlItem id="table">Table</SegmentedControlItem>
              </SegmentedControl>
            </>
          )}
          <TooltipTrigger>
            <ToggleButton
              size="S"
              aria-label="Annotate this span"
              isSelected={isAnnotatingSpans}
              onChange={(isSelected) => {
                if (isSelected) {
                  openSpanAnnotationEditor("annotations");
                } else {
                  setIsAnnotatingSpans(false);
                }
              }}
              leadingVisual={<Icon svg={<Icons.Edit2 />} />}
            />
            <Tooltip offset={1}>
              <Flex direction="row" gap="size-100" alignItems="center">
                Annotate <Keyboard>{EDIT_ANNOTATION_HOTKEY}</Keyboard>
              </Flex>
            </Tooltip>
          </TooltipTrigger>
        </Flex>
      }
    >
      {/* both views fetch on mount, and this card sits on every span info
          view -- hold the query until the reader opens it */}
      {isCollapsed ? null : (
        <Suspense fallback={<Loading />}>
          {view === "list" ? (
            <div css={annotationTokenListCSS}>
              <SpanAnnotationSummaryTokens
                spanNodeId={spanNodeId}
                renderEmptyState={() => emptyState}
              />
            </div>
          ) : (
            <SpanAnnotationsTable
              spanNodeId={spanNodeId}
              areRowsExpanded={areRowsExpanded}
              emptyState={emptyState}
            />
          )}
        </Suspense>
      )}
    </Card>
  );
}
