import { css } from "@emotion/react";

import { Skeleton } from "@phoenix/components/core/loading";

const searchBarSkeletonCSS = css`
  flex: none;
  display: grid;
  /* The search field takes the row; a control beside it keeps its width */
  grid-template-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: auto;
  align-items: center;
  gap: var(--global-dimension-size-100);
  padding: var(--global-dimension-size-100);
  &[data-divider="true"] {
    /* The loaded bar's divider is left undrawn, but its space is kept */
    padding-bottom: calc(
      var(--global-dimension-size-100) + var(--global-border-size-thin)
    );
  }
`;

/**
 * An Evaluators tab's search bar while the tab loads: the search field, and
 * the control beside it if there is one, at their loaded sizes.
 */
export function SearchBarSkeleton({
  hasDivider = false,
  trailingControlWidth,
}: {
  /**
   * Whether the loaded bar has a divider below it. The skeleton draws none
   * but keeps its space, so the content below stays in place.
   * @default false
   */
  hasDivider?: boolean;
  /** The width of a button beside the search field, if the bar has one. */
  trailingControlWidth?: string;
}) {
  return (
    <div css={searchBarSkeletonCSS} data-divider={hasDivider}>
      <Skeleton height="var(--global-input-height-m)" />
      {trailingControlWidth != null ? (
        <Skeleton
          width={trailingControlWidth}
          height="var(--global-button-height-m)"
        />
      ) : null}
    </div>
  );
}
