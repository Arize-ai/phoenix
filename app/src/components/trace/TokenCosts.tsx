import { forwardRef, HTMLAttributes, Ref } from "react";
import { css } from "@emotion/react";

import { Icon, Icons, Text, TextProps } from "@phoenix/components";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

const tokenCostsItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--ac-global-dimension-static-size-50);
  align-items: center;

  &[data-size="S"] {
    font-size: var(--ac-global-font-size-s);
  }
  &[data-size="M"] {
    font-size: var(--ac-global-font-size-m);
  }
`;

interface TokenCostsProps extends HTMLAttributes<HTMLDivElement> {
  children: number | null | undefined;
  size?: TextProps["size"];
}

function TokenCosts(props: TokenCostsProps, ref: Ref<HTMLDivElement>) {
  const { children, size = "M", ...otherProps } = props;

  const text = typeof children === "number" ? costFormatter(children) : "--";
  return (
    <div
      className="token-costs-item"
      data-size={size}
      css={tokenCostsItemCSS}
      ref={ref}
      {...otherProps}
    >
      <Icon
        svg={<Icons.PriceTagsOutline />}
        css={css`
          color: var(--ac-global-text-color-900);
        `}
      />
      <Text size={props.size}>{text}</Text>
    </div>
  );
}

const _TokenCosts = forwardRef(TokenCosts);
export { _TokenCosts as TokenCosts };
