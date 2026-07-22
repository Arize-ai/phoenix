import { css } from "@emotion/react";
import type { HTMLAttributes, Ref } from "react";

import type { TextProps } from "@phoenix/components";
import { Text } from "@phoenix/components";
import { quietHoverCSS } from "@phoenix/components/core/styles";
import { costFormatter } from "@phoenix/utils/numberFormatUtils";

const tokenCostsItemCSS = css`
  display: flex;
  flex-direction: row;
  gap: var(--global-dimension-size-50);
  align-items: center;

  &[data-size="S"] {
    font-size: var(--global-font-size-s);
  }
  &[data-size="M"] {
    font-size: var(--global-font-size-m);
  }
  &[role="button"] {
    ${quietHoverCSS}
  }
`;

interface TokenCostsProps extends HTMLAttributes<HTMLDivElement> {
  children: number | null | undefined;
  size?: TextProps["size"];
  color?: TextProps["color"];
}

function TokenCosts({
  ref,
  ...props
}: TokenCostsProps & { ref?: Ref<HTMLDivElement> }) {
  const { children, size = "M", color = "text-900", ...otherProps } = props;

  const text = typeof children === "number" ? costFormatter(children) : "--";
  return (
    <div
      className="token-costs-item"
      data-size={size}
      css={tokenCostsItemCSS}
      ref={ref}
      {...otherProps}
    >
      <Text size={props.size} color={color} fontFamily="mono">
        {text}
      </Text>
    </div>
  );
}

export { TokenCosts };
