import { forwardRef, HTMLAttributes, Ref } from "react";
import { css } from "@emotion/react";

import { Icon, Icons, Text, TextProps } from "@phoenix/components";
import { formatNumber } from "@phoenix/utils/numberFormatUtils";

const tokenCountItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-static-size-50);
  align-items: center;

  &[data-size="S"] {
    font-size: var(--global-font-size-s);
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
  }
`;

interface TokenCountProps extends HTMLAttributes<HTMLDivElement> {
  children: number | null | undefined;
  size?: TextProps["size"];
}

function TokenCount(props: TokenCountProps, ref: Ref<HTMLDivElement>) {
  const { children, size = "M", ...otherProps } = props;

  const text = typeof children === "number" ? formatNumber(children) : "--";
  return (
    <div
      className="token-count-item"
      data-size={size}
      css={tokenCountItemCSS}
      ref={ref}
      {...otherProps}
    >
      <Icon
        svg={<Icons.TokensOutline />}
        css={css`
          color: var(--global-text-color-900);
        `}
      />
      <Text size={props.size} fontFamily="mono">
        {text}
      </Text>
    </div>
  );
}

const _TokenCount = forwardRef(TokenCount);
export { _TokenCount as TokenCount };
