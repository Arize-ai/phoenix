import React from "react";
import { css } from "@emotion/react";

import { Button, Icon, Icons } from "@phoenix/components";

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
const buttonCSS = css`
  border-radius: 16px;
  padding: var(--ac-global-dimension-size-50)
    var(--ac-global-dimension-size-200) !important;
`;
/**
 * A table row that is used to load more data.
 * @returns A table row that is used to load more data.
 */
export function LoadMoreRow({
  onLoadMore,
  isLoadingNext,
}: {
  onLoadMore: () => void;
  isLoadingNext: boolean;
  /**
   * The width of the table. we need this to make the button span the entire width of the table.
   */
  width: number;
}) {
  return (
    <tr css={rowCSS}>
      <td colSpan={100} css={tdCSS}>
        <Button
          onPress={() => {
            onLoadMore();
          }}
          size="S"
          css={buttonCSS}
          isDisabled={isLoadingNext}
          leadingVisual={
            isLoadingNext ? <Icon svg={<Icons.LoadingOutline />} /> : undefined
          }
        >
          {isLoadingNext ? "Loading..." : "Load More"}
        </Button>
      </td>
    </tr>
  );
}
