import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { DisclosureArrow, Flex, Text, Truncate } from "@phoenix/components";
import { useTimeFormatters } from "@phoenix/hooks";

import { LatencyText } from "./LatencyText";
import { TokenCosts } from "./TokenCosts";
import { TokenCount } from "./TokenCount";
import { TraceErrorCount } from "./TraceErrorCount";
import { TraceTreeRowControls } from "./TraceTreeRowControls";

export type TraceSummaryRowProps = {
  actions?: ReactNode;
  cost?: number | null;
  disclosureTestId?: string;
  errorCount: number;
  index?: number;
  /** Whether the trace or one of its descendant spans owns the active branch. */
  isActive: boolean;
  isExpanded: boolean;
  /** Whether the trace itself, rather than a descendant span, owns selection. */
  isSelected: boolean;
  latencyMs?: number | null;
  name: string;
  onSelect: () => void;
  onToggleExpanded: () => void;
  startTime?: string | null;
  tokenCountTotal?: number | null;
  traceId: string;
};

const traceSummaryRowCSS = css`
  display: flex;
  align-items: flex-start;
  min-height: var(--global-details-panel-navigation-row-height);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  color: inherit;

  &:hover {
    background-color: var(--global-list-item-hover-background-color);
  }

  &[data-selected="true"] {
    background-color: var(
      --global-details-panel-navigation-row-selected-background-color
    );
    color: var(--global-text-color-900);
  }

  &[data-selected="true"] .trace-summary-row__select {
    border-left-color: var(
      --global-details-panel-navigation-row-selected-border-color
    );
  }

  .trace-summary-row__select {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex: 1 1 auto;
    align-items: flex-start;
    min-width: 0;
    min-height: var(--global-details-panel-navigation-row-height);
    gap: var(--global-dimension-size-100);
    padding: var(
        --global-session-details-navigation-top-level-row-padding-block
      )
      0 var(--global-session-details-navigation-top-level-row-padding-block)
      var(--global-details-panel-navigation-row-content-padding-inline-start);
    border: none;
    /* Reserve the selected-state indicator so selection does not move content. */
    border-left: 4px solid transparent;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .trace-summary-row__select:focus-visible,
  .trace-summary-row__disclosure:focus-visible {
    outline: var(--focus-ring-thickness) solid var(--focus-ring-color);
    outline-offset: calc(-1 * var(--focus-ring-thickness));
  }

  .trace-summary-row__compact-index {
    display: none;
  }

  .trace-summary-row__title {
    gap: var(--global-session-details-navigation-top-level-row-title-gap);
  }

  .trace-summary-row__annotation-action {
    opacity: 0;
    pointer-events: none;
  }

  &:hover .trace-summary-row__annotation-action,
  &:focus-within .trace-summary-row__annotation-action,
  &:has(
      .trace-summary-row__annotation-action [data-annotation-menu-open="true"]
    )
    .trace-summary-row__annotation-action {
    opacity: 1;
    pointer-events: auto;
  }

  .trace-summary-row__controls {
    align-items: flex-start;
    padding-top: var(
      --global-session-details-navigation-top-level-row-padding-block
    );
  }

  .trace-summary-row__disclosure {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--global-dimension-size-250);
    height: var(--global-dimension-size-250);
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
`;

/**
 * Selectable trace summary with an independently operated tree disclosure.
 * Selecting the active trace again toggles its disclosure.
 */
export function TraceSummaryRow({
  actions,
  cost,
  disclosureTestId,
  errorCount,
  index,
  isActive,
  isExpanded,
  isSelected,
  latencyMs,
  name,
  onSelect,
  onToggleExpanded,
  startTime,
  tokenCountTotal,
  traceId,
}: TraceSummaryRowProps) {
  const { fullTimeFormatter } = useTimeFormatters();
  const paddedIndex = index == null ? null : String(index + 1).padStart(2, "0");
  const hasMetrics =
    tokenCountTotal != null ||
    cost != null ||
    latencyMs != null ||
    errorCount > 0;
  const traceLabel = name || "Trace";
  const traceAriaLabel =
    errorCount > 0
      ? `View trace ${traceId}, ${errorCount} ${errorCount === 1 ? "error" : "errors"}`
      : `View trace ${traceId}`;

  return (
    <div
      className="trace-summary-row"
      css={traceSummaryRowCSS}
      data-selected={isActive || undefined}
    >
      <button
        type="button"
        className="trace-summary-row__select"
        aria-label={traceAriaLabel}
        aria-pressed={isSelected}
        onClick={isSelected ? onToggleExpanded : onSelect}
      >
        {paddedIndex ? (
          <Text
            className="trace-summary-row__compact-index"
            fontFamily="mono"
            color="text-500"
          >
            {paddedIndex}
          </Text>
        ) : null}
        <Flex
          className="trace-summary-row__expanded-content"
          direction="column"
          gap="size-100"
          flex={1}
          minWidth={0}
        >
          <Flex
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap="size-100"
          >
            <Flex
              className="trace-summary-row__title"
              direction="row"
              alignItems="center"
              flex={1}
              minWidth={0}
            >
              {paddedIndex ? (
                <Text fontFamily="mono" color="text-500">
                  {paddedIndex}
                </Text>
              ) : null}
              <Flex flex={1} minWidth={0}>
                <Truncate maxWidth="100%" title={traceLabel}>
                  <Text weight="heavy">{traceLabel}</Text>
                </Truncate>
              </Flex>
            </Flex>
            {startTime ? (
              <Text color="text-700" size="XS">
                {fullTimeFormatter(new Date(startTime))}
              </Text>
            ) : null}
          </Flex>
          {hasMetrics ? (
            <Flex direction="row" gap="size-100" alignItems="center" wrap>
              {tokenCountTotal != null ? (
                <TokenCount size="S">{tokenCountTotal}</TokenCount>
              ) : null}
              {cost != null ? <TokenCosts size="S">{cost}</TokenCosts> : null}
              {latencyMs != null ? (
                <LatencyText latencyMs={latencyMs} size="S" />
              ) : null}
              <TraceErrorCount errorCount={errorCount} />
            </Flex>
          ) : null}
        </Flex>
      </button>
      <TraceTreeRowControls
        className="trace-summary-row__controls"
        disclosure={
          <button
            data-testid={disclosureTestId}
            type="button"
            className="trace-summary-row__disclosure"
            aria-label={`${isExpanded ? "Collapse" : "Expand"} trace ${traceId}`}
            aria-expanded={isExpanded}
            onClick={onToggleExpanded}
          >
            <DisclosureArrow isExpanded={isExpanded} />
          </button>
        }
        actions={actions}
        actionsClassName="trace-summary-row__annotation-action"
      />
    </div>
  );
}
