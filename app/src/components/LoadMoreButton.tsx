import { css } from "@emotion/react";

import { Button, ButtonProps } from "@phoenix/components/button";
import { Icon, Icons } from "@phoenix/components/icon";

export type LoadMoreButtonProps = {
  onLoadMore: () => void;
  isLoadingNext: boolean;
  buttonProps?: ButtonProps;
};

const buttonCSS = css`
  border-radius: 16px;
  padding: var(--ac-global-dimension-size-50)
    var(--ac-global-dimension-size-200) !important;
`;

export const LoadMoreButton = ({
  onLoadMore,
  isLoadingNext,
  buttonProps,
}: LoadMoreButtonProps) => {
  return (
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
      {...buttonProps}
    >
      {isLoadingNext ? "Loading..." : "Load More"}
    </Button>
  );
};
