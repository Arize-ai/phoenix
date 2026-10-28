import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { classNames } from "@phoenix/utils/classNames";

import type { SpanTimingDetailsProps } from "./SpanTimingDetails";
import { SpanTimingDetails } from "./SpanTimingDetails";
import type {
  TokenDetailsBreakdownProps,
  TokenDetailsBreakdownSkeletonProps,
} from "./TokenDetailsBreakdown";
import {
  TokenDetailsBreakdown,
  TokenDetailsBreakdownError,
  TokenDetailsBreakdownSkeleton,
} from "./TokenDetailsBreakdown";

const cardCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-150);

  .row-preview-card__header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
  }
  /* Dividers run to the tooltip's edges; content keeps its inset */
  .row-preview-card__header ~ * + * {
    margin-inline: calc(-1 * var(--rich-tooltip-padding-x, 0px));
    padding-inline: var(--rich-tooltip-padding-x, 0px);
    padding-top: var(--global-dimension-size-150);
    border-top: var(--global-border-size-thin) solid
      var(--global-color-gray-300);
  }
`;

export type RowPreviewCardProps = {
  /** The header's contents, laid out in a row and centered on its line. */
  header: ReactNode;
  timing: SpanTimingDetailsProps;
  /** Omit while loading; a skeleton then surrounds `totals`. */
  metricsDetails?: TokenDetailsBreakdownProps | null;
  /** Shown in place of the breakdown when it failed to load. */
  metricsError?: ReactNode;
  /** The totals the row already shows, for the skeleton. */
  totals: {
    tokens: number | null | undefined;
    cost: number | null | undefined;
  };
  /**
   * Token-type rows the skeleton leaves room for.
   * @default the skeleton's own default
   */
  skeletonRows?: TokenDetailsBreakdownSkeletonProps["rows"];
  /** The evals, between the timing and the breakdown. */
  children?: ReactNode;
  className?: string;
};

/**
 * The shell of a list row's preview, shared by the trace tree's and the
 * session turn list's: the header, the timing, the evals, then the token and
 * cost breakdown, with dividers between sections that run to the tooltip's
 * edges.
 */
export function RowPreviewCard({
  header,
  timing,
  metricsDetails,
  metricsError,
  totals,
  skeletonRows,
  children,
  className,
}: RowPreviewCardProps) {
  return (
    <div className={classNames("row-preview-card", className)} css={cardCSS}>
      <header className="row-preview-card__header">{header}</header>
      <SpanTimingDetails {...timing} />
      {children}
      {metricsError != null ? (
        <TokenDetailsBreakdownError
          tokens={{ total: totals.tokens }}
          costs={{ total: totals.cost }}
          error={metricsError}
        />
      ) : metricsDetails ? (
        <TokenDetailsBreakdown {...metricsDetails} />
      ) : (
        <TokenDetailsBreakdownSkeleton
          tokens={{ total: totals.tokens }}
          costs={{ total: totals.cost }}
          rows={skeletonRows}
        />
      )}
    </div>
  );
}
