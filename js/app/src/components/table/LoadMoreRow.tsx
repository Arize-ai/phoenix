import { css } from "@emotion/react";

import type { LoadMoreButtonProps } from "@phoenix/components/core/LoadMoreButton";
import { LoadMoreButton } from "@phoenix/components/core/LoadMoreButton";

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
