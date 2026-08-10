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
import { useProjectAnnotationConfigsByName } from "@phoenix/components/annotation/useProjectAnnotationConfigsByName";
import { CompactEmptyState } from "@phoenix/components/core/empty";
import { RowExpandToggleButton } from "@phoenix/components/table";
import { EDIT_ANNOTATION_HOTKEY } from "@phoenix/constants/annotationConstants";
import { usePreferencesContext } from "@phoenix/contexts";

import { SpanAnnotationsTable } from "../SpanAnnotationsTable";
import { useOpenSpanAside } from "../SpanAsideContext";
import { useSpanInfoCardProps } from "../SpanInfoCardsContext";
import type { SpanAnnotationsCardSummaryQuery } from "./__generated__/SpanAnnotationsCardSummaryQuery.graphql";
import { defaultCardProps } from "./constants";
import { useSpanAnnotationCounts } from "./useSpanAnnotationCounts";

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
 * One summary token per annotation name, each opening the annotations behind it
 * in a popover. Unstyled — the caller owns the layout.
 */
function SpanAnnotationSummaryTokens({
  spanNodeId,
  renderEmptyState,
}: {
  spanNodeId: string;
  renderEmptyState?: () => ReactNode;
}) {
  const data = useLazyLoadQuery<SpanAnnotationsCardSummaryQuery>(
    graphql`
      query SpanAnnotationsCardSummaryQuery($id: ID!) {
        span: node(id: $id) {
          ... on Span {
            project {
              ...ProjectAnnotationConfigFragment
            }
            ...AnnotationSummaryGroup
          }
        }
      }
    `,
    { id: spanNodeId },
    // usually already in the store, pulled in by the span details query
    { fetchPolicy: "store-or-network" }
  );
  const annotationConfigsByName = useProjectAnnotationConfigsByName(
    data.span?.project
  );
  if (data.span == null) {
    return null;
  }
  return (
    <AnnotationSummaryGroupTokens
      span={data.span}
      annotationConfigsByName={annotationConfigsByName}
      renderEmptyState={renderEmptyState}
    />
  );
}

/**
 * The annotations attached to a span, as a card for the span info view. The
 * table inside fetches its own data, so this only needs the span's node id.
 */
export function SpanAnnotationsCard({ spanNodeId }: { spanNodeId: string }) {
  // better a card that renders late than one that reads "no annotations" while
  // the count is still in flight
  return (
    <Suspense fallback={null}>
      <SpanAnnotationsCardContents spanNodeId={spanNodeId} />
    </Suspense>
  );
}

function SpanAnnotationsCardContents({ spanNodeId }: { spanNodeId: string }) {
  const { annotationCount } = useSpanAnnotationCounts({ spanNodeId });
  const isAnnotatingSpans = usePreferencesContext(
    (state) => state.isAnnotatingSpans
  );
  const setIsAnnotatingSpans = usePreferencesContext(
    (state) => state.setIsAnnotatingSpans
  );
  const openSpanAside = useOpenSpanAside();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [areRowsExpanded, setAreRowsExpanded] = useState(false);
  const [view, setView] = useState<SpanAnnotationsView>("list");
  const cardProps = useSpanInfoCardProps("annotations");
  const hasAnnotations = annotationCount > 0;
  const emptyState = (
    <CompactEmptyState
      icon={<Icon svg={<Icons.Edit2 />} />}
      description="No annotations on this span"
    />
  );
  return (
    <Card
      {...defaultCardProps}
      {...cardProps}
      title="Annotations"
      titleExtra={<Counter variant="quiet">{annotationCount}</Counter>}
      // the summary tokens are clickable, so the collapse toggle is a
      // standalone arrow rather than a button wrapping the whole header
      interactiveTitle
      collapseButtonLabel="Annotations"
      headerContent={
        // the open card's body carries the same summary, in full
        !hasAnnotations || !isCollapsed ? null : (
          // no fallback: a spinner here would only flash
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
          {isCollapsed || !hasAnnotations ? null : (
            <>
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
                  openSpanAside();
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
      {/* both views fetch on mount, so hold the query until the card is open */}
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
