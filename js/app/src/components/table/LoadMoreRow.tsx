import { css } from "@emotion/react";

import type { LoadMoreButtonProps } from "@phoenix/components/core/LoadMoreButton";
import { LoadMoreButton } from "@phoenix/components/core/LoadMoreButton";

/*
 * The absolute cell centers the button across the full row width, so the row
 * has to reserve the cell's height itself or the cell hangs below the table
 * and adds a sliver of scroll to a content-sized container. Important because
 * table styles give every body row "height: 100%", which resolves to zero for
 * a row with no in-flow content.
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
