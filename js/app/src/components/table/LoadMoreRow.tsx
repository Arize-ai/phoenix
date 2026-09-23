import { css } from "@emotion/react";

import type { LoadMoreButtonProps } from "@phoenix/components/core/LoadMoreButton";
import { LoadMoreButton } from "@phoenix/components/core/LoadMoreButton";

const tdCSS = css`
  text-align: center;
`;

const buttonWrapCSS = css`
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
    <tr>
      <td colSpan={100} css={tdCSS}>
        <div css={buttonWrapCSS}>
          <LoadMoreButton
            onLoadMore={onLoadMore}
            isLoadingNext={isLoadingNext}
          />
        </div>
      </td>
    </tr>
  );
}
