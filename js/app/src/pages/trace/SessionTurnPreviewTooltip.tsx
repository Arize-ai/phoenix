import { getScrollParent } from "@react-aria/utils";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import {
  TooltipContext,
  TooltipTriggerStateContext,
} from "react-aria-components";
import { graphql } from "react-relay";
import type { TooltipTriggerState } from "react-stately";
import { useTooltipTriggerState } from "react-stately";

import { RichTooltip, TooltipArrow } from "@phoenix/components";
import type { AnnotationOptimizationConfig } from "@phoenix/components/annotation/optimizationUtils";
import {
  rowPreviewTooltipCSS,
  RowPreviewQuery,
} from "@phoenix/components/trace/RowPreviewQuery";
import { getTokenCostDetailsFromCostDetails } from "@phoenix/components/trace/TokenCostsDetails";
import { getTokenCountDetailsFromCostDetails } from "@phoenix/components/trace/TokenCountDetails";
import type { TokenDetailsBreakdownProps } from "@phoenix/components/trace/TokenDetailsBreakdown";
import { TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH } from "@phoenix/components/trace/TokenDetailsBreakdown";

import type {
  SessionTurnPreviewTooltipUsageQuery as SessionTurnPreviewTooltipUsageQueryType,
  SessionTurnPreviewTooltipUsageQuery$data,
} from "./__generated__/SessionTurnPreviewTooltipUsageQuery.graphql";
import type {
  SessionTurnPreviewCardProps,
  SessionTurnPreviewTurn,
} from "./SessionTurnPreviewCard";
import { SessionTurnPreviewCard } from "./SessionTurnPreviewCard";

/** Matches the trace tree: React Aria warms up, so later rows open at once. */
const TURN_PREVIEW_DELAY_MS = 150;

/**
 * The turn's token and cost split, measured the way its row is: tokens from
 * the root span's cumulative counts and costs from the trace.
 *
 * @remarks
 * The row shows the root span's `cumulativeTokenCountTotal` and the trace's
 * `costSummary`, as the selected turn's header does: the schema has no
 * trace-level token totals and no root-span cumulative cost summary. Each
 * measure takes its token-type split from the same scope as its totals, so
 * every bar adds up to the number on the row.
 */
const SessionTurnPreviewTooltipUsageQuery = graphql`
  query SessionTurnPreviewTooltipUsageQuery($traceNodeId: ID!) {
    node(id: $traceNodeId) {
      __typename
      ... on Trace {
        rootSpan {
          cumulativeTokenCountTotal
          cumulativeTokenCountPrompt
          cumulativeTokenCountCompletion
          cumulativeCostDetailSummaryEntries {
            tokenType
            isPrompt
            value {
              tokens
            }
          }
        }
        costSummary {
          total {
            cost
          }
          prompt {
            cost
          }
          completion {
            cost
          }
        }
        costDetailSummaryEntries {
          tokenType
          isPrompt
          value {
            cost
          }
        }
      }
    }
  }
`;

export type SessionTurnPreviewTarget = {
  /** The hovered or keyboard-focused turn row the preview anchors to. */
  element: Element;
  turn: SessionTurnPreviewTurn;
};

type SessionTurnListPreviewProps = {
  target: SessionTurnPreviewTarget | null;
  annotationConfigsByName: ReadonlyMap<string, AnnotationOptimizationConfig>;
  /**
   * Keep the preview open through what would close it on its own: the list
   * scrolling, as it does when arrowing past the fold. For a preview that
   * follows keyboard focus, which stays on the row as it scrolls; a hovered
   * row's preview closes on scroll, as the trace tree's do. It still closes
   * once its row has scrolled out of the list's view.
   * @default false
   */
  shouldReopenOnClose?: boolean;
  /**
   * Called when Escape dismisses the preview, or when a preview kept open by
   * `shouldReopenOnClose` closes because its row scrolled out of view. Clear
   * the target, so it stays closed until another row is hovered or focused.
   */
  onDismiss: () => void;
};

/**
 * One preview for the whole turn list, following the active row.
 *
 * @remarks
 * `TooltipTrigger` hands its hover and focus handlers to its child through
 * `FocusableContext`, which `ListBoxItem` does not read, so the list reports
 * the active row instead and this supplies the contexts `TooltipTrigger`
 * would. It sits outside the items on purpose: inside one, its `Text`s pick
 * up the option's slotted label/description ids and React Aria's id merging
 * loops.
 */
export function SessionTurnListPreview({
  target,
  annotationConfigsByName,
  shouldReopenOnClose = false,
  onDismiss,
}: SessionTurnListPreviewProps) {
  const state = useTooltipTriggerState({
    delay: TURN_PREVIEW_DELAY_MS,
    closeDelay: 0,
  });
  const isActive = target != null;
  const tooltipState = useReopeningTooltipState({
    state,
    shouldReopen: isActive && shouldReopenOnClose,
    triggerElement: target?.element ?? null,
    onTriggerHidden: onDismiss,
  });
  useDismissOnEscape({ isOpen: isActive && state.isOpen, onDismiss });

  // open/close are recreated every render; only the target should re-run this
  const syncOpen = useEffectEvent((shouldOpen: boolean) => {
    if (shouldOpen) {
      state.open();
    } else {
      state.close(true);
    }
  });
  useEffect(() => {
    syncOpen(isActive);
  }, [target, isActive]);

  const triggerRef = useMemo(
    () => ({ current: target?.element ?? null }),
    [target]
  );

  if (target == null) {
    return null;
  }
  return (
    <TooltipTriggerStateContext.Provider value={tooltipState}>
      <TooltipContext.Provider value={{ triggerRef }}>
        {/* Keyed so hopping rows while open re-anchors the preview and
            restarts its usage fetch for the new turn */}
        <SessionTurnPreviewTooltip
          key={target.turn.traceId}
          turn={target.turn}
          annotationConfigsByName={annotationConfigsByName}
        />
      </TooltipContext.Provider>
    </TooltipTriggerStateContext.Provider>
  );
}

export type SessionTurnPreviewTooltipProps = Pick<
  SessionTurnPreviewCardProps,
  "turn" | "annotationConfigsByName"
>;

/**
 * A session turn row's tooltip: a {@link SessionTurnPreviewCard} that loads
 * the turn's token and cost breakdown once the tooltip settles.
 *
 * @remarks
 * Render it as the tooltip of a `TooltipTrigger`, or of the trigger state
 * and context {@link SessionTurnListPreview} supplies for the turn list.
 */
export function SessionTurnPreviewTooltip(
  props: SessionTurnPreviewTooltipProps
) {
  return (
    <RichTooltip
      placement="right top"
      width={TOKEN_DETAILS_BREAKDOWN_TOOLTIP_WIDTH}
      css={rowPreviewTooltipCSS}
    >
      <TooltipArrow />
      <SessionTurnPreviewDetails {...props} />
    </RichTooltip>
  );
}

/**
 * The trigger state the tooltip reads, which reopens the tooltip after it
 * closes itself while `shouldReopen` holds.
 *
 * @remarks
 * React Aria's `Tooltip` closes itself through this state when an ancestor
 * of its trigger scrolls, since it can't follow the trigger, and when the
 * pointer leaves it. The list's preview target is unchanged by either, so
 * nothing would open it again. Reopening in a separate commit, rather than
 * ignoring the close, makes the tooltip measure its position afresh against
 * the scrolled row; doing it in a layout effect does so before paint, so it
 * doesn't flicker. A trigger scrolled out of view, as by the wheel, stays
 * closed and `onTriggerHidden` is called, rather than pinning the tooltip to
 * the edge of the viewport. The list's own opens and closes use `state`
 * directly.
 */
function useReopeningTooltipState({
  state,
  shouldReopen,
  triggerElement,
  onTriggerHidden,
}: {
  state: TooltipTriggerState;
  shouldReopen: boolean;
  triggerElement: Element | null;
  onTriggerHidden: () => void;
}): TooltipTriggerState {
  const [closeCount, setCloseCount] = useState(0);
  const reopen = useEffectEvent(() => {
    if (!shouldReopen || state.isOpen) {
      return;
    }
    if (triggerElement && !isElementInScrollView(triggerElement)) {
      onTriggerHidden();
      return;
    }
    state.open(true);
  });
  useLayoutEffect(() => {
    if (closeCount > 0) {
      reopen();
    }
  }, [closeCount]);
  if (!shouldReopen) {
    return state;
  }
  return {
    ...state,
    close: (immediate) => {
      state.close(immediate);
      setCloseCount((count) => count + 1);
    },
  };
}

/**
 * Whether any of `element` lies within its scroll container's visible area.
 *
 * @remarks
 * Edges count as visible, so elements without layout (zero-sized rects, as
 * in jsdom) are treated as visible.
 */
export function isElementInScrollView(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const scrollParent = getScrollParent(element);
  const isViewport =
    scrollParent === document.scrollingElement ||
    scrollParent === document.documentElement;
  const view = isViewport
    ? { top: 0, bottom: window.innerHeight }
    : scrollParent.getBoundingClientRect();
  return rect.bottom >= view.top && rect.top <= view.bottom;
}

/**
 * Dismisses the open preview on Escape before anything else hears it, as
 * React Aria's `useTooltipTrigger` does for the trace tree's previews, so
 * the first Escape closes only the preview and not the drawer around the
 * list (WCAG 1.4.13).
 */
function useDismissOnEscape({
  isOpen,
  onDismiss,
}: {
  isOpen: boolean;
  onDismiss: () => void;
}) {
  const dismiss = useEffectEvent(onDismiss);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        dismiss();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", onKeyDown, true);
    }
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen]);
}

const EMPTY_METRICS_DETAILS: TokenDetailsBreakdownProps = {};

function SessionTurnPreviewDetails(props: SessionTurnPreviewTooltipProps) {
  const { turn } = props;
  // A turn without usage has no split to load
  if (!turn.tokenCountTotal && !turn.costTotal) {
    return (
      <SessionTurnPreviewCard
        {...props}
        metricsDetails={EMPTY_METRICS_DETAILS}
      />
    );
  }
  return (
    <RowPreviewQuery<SessionTurnPreviewTooltipUsageQueryType>
      query={SessionTurnPreviewTooltipUsageQuery}
      variables={{ traceNodeId: turn.traceNodeId }}
      placeholder={<SessionTurnPreviewCard {...props} />}
    >
      {(data) => (
        <SessionTurnPreviewCard
          {...props}
          metricsDetails={getTurnMetricsDetails(data.node)}
        />
      )}
    </RowPreviewQuery>
  );
}

type UsageNode = SessionTurnPreviewTooltipUsageQuery$data["node"];

/**
 * Maps the usage query onto the breakdown's props; see
 * {@link SessionTurnPreviewTooltipUsageQuery} for which scope each measure
 * comes from.
 */
function getTurnMetricsDetails(node: UsageNode): TokenDetailsBreakdownProps {
  if (node.__typename !== "Trace") {
    return EMPTY_METRICS_DETAILS;
  }
  const { rootSpan, costSummary, costDetailSummaryEntries } = node;
  return {
    tokens: rootSpan
      ? {
          total: rootSpan.cumulativeTokenCountTotal,
          prompt: rootSpan.cumulativeTokenCountPrompt,
          completion: rootSpan.cumulativeTokenCountCompletion,
          ...getTokenCountDetailsFromCostDetails(
            rootSpan.cumulativeCostDetailSummaryEntries
          ),
        }
      : null,
    costs: {
      total: costSummary.total.cost,
      prompt: costSummary.prompt.cost,
      completion: costSummary.completion.cost,
      ...getTokenCostDetailsFromCostDetails(costDetailSummaryEntries),
    },
  };
}
