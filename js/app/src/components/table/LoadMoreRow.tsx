import { css } from "@emotion/react";

import type { LoadMoreButtonProps } from "@phoenix/components/core/LoadMoreButton";
import { LoadMoreButton } from "@phoenix/components/core/LoadMoreButton";

/*
 * The cell is absolutely positioned so the button can center across the whole
 * row, which leaves the row with no in-flow content and a height of zero. The
 * row reserves the cell's height itself so the cell does not hang below the
 * table.
 */
const rowCSS = css`
  position: relative;
  height: var(--global-dimension-size-600) !important;
`;
const tdCSS = css`
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
`;

/**
 * A table row that is used to load more data.
 * @returns A table row that is used to load more data.
 */
export function LoadMoreRow({
  onLoadMore,
  isLoadingNext,
}: LoadMoreButtonProps) {
  return (
    <tr css={rowCSS}>
      <td colSpan={100} css={tdCSS}>
        <LoadMoreButton onLoadMore={onLoadMore} isLoadingNext={isLoadingNext} />
      </td>
    </tr>
  );
}
