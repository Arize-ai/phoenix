import { forwardRef } from "react";
import { css, SerializedStyles } from "@emotion/react";

import {
  LoadMoreButton,
  LoadMoreButtonProps,
} from "@phoenix/components/LoadMoreButton";

const rowCSS = css`
  position: relative;
  height: 100px !important;
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

export interface LoadMoreRowProps extends LoadMoreButtonProps {
  css?: SerializedStyles;
  className?: string;
}

/**
 * A table row that is used to load more data.
 * @returns A table row that is used to load more data.
 */
export const LoadMoreRow = forwardRef<HTMLTableRowElement, LoadMoreRowProps>(
  function LoadMoreRow(
    { onLoadMore, isLoadingNext, className, ...props },
    ref
  ) {
    const { css: propCSS } = props;
    return (
      <tr
        ref={ref}
        css={css(rowCSS, propCSS)}
        data-testid="load-more-row"
        className={className}
        {...props}
      >
        <td colSpan={100} css={tdCSS}>
          <LoadMoreButton
            onLoadMore={onLoadMore}
            isLoadingNext={isLoadingNext}
          />
        </td>
      </tr>
    );
  }
);
