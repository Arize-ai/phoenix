import { css } from "@emotion/react";

import {
  LoadMoreButton,
  LoadMoreButtonProps,
} from "@phoenix/components/LoadMoreButton";

const rowCSS = css`
  position: relative;
`;
const tdCSS = css`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
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
